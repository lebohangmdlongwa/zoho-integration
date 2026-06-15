import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { upsertToken, updateToken } from '../../../backend/_shared/db.ts';
import {
  createZohoContext,
  ensureIntegrationFields,
  registerWebhookChannel,
  getOrgId,
  deriveDCFromApiDomain,
} from '../../../backend/zoho-client.ts';
import { logger } from '../../../backend/logger.ts';

export const POST: APIRoute = async ({ request, url }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  const siteId = tokenInfo?.siteId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { code } = (await request.json()) as { code: string };
  if (!code) return Response.json({ error: 'Missing code' }, { status: 400 });

  logger.info('[exchange-token] connect started', { instanceId, siteId });

  const envOrProc = (key: string) =>
    (import.meta.env[key] ?? process.env[key]) as string | undefined;

  const redirectUri =
    envOrProc('ZOHO_REDIRECT_URI') ?? `${url.origin}/api/zoho/callback`;

  logger.info('[exchange-token] using redirect URI', { redirectUri });

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: envOrProc('ZOHO_CLIENT_ID')!,
    client_secret: envOrProc('ZOHO_CLIENT_SECRET')!,
    redirect_uri: redirectUri,
    code,
  });

  const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    logger.error('[exchange-token] ZOHO token exchange failed', { status: tokenRes.status, body });
    return Response.json({ error: 'Token exchange failed', detail: body }, { status: 502 });
  }

  const tokens: ZohoTokenResponse = await tokenRes.json();
  const apiDomain = tokens.api_domain ?? 'https://www.zohoapis.com';
  const dc = deriveDCFromApiDomain(apiDomain);
  logger.info('[exchange-token] token exchanged', { apiDomain, dc, hasRefreshToken: !!tokens.refresh_token });

  await upsertToken({
    instance_id: instanceId,
    site_id: siteId ?? null,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? '',
    expires_at: Date.now() + tokens.expires_in * 1000,
    org_id: null,
    api_domain: apiDomain,
    dc,
    channel_id: null,
    channel_expiry: null,
    connected_at: Date.now(),
  });

  let orgId: string | null = null;
  try {
    const ctx = await createZohoContext(instanceId);
    orgId = await getOrgId(ctx);
    if (orgId) await updateToken(instanceId, { org_id: orgId });
    logger.info('[exchange-token] org ID fetched', { instanceId, orgId });
  } catch (err) {
    logger.warn('[exchange-token] could not fetch ZOHO org ID', { err: String(err) });
  }

  try {
    const ctx = await createZohoContext(instanceId);
    await ensureIntegrationFields(ctx);
    logger.info('[exchange-token] integration fields ensured', { instanceId });
  } catch (err) {
    logger.warn('[exchange-token] could not ensure ZOHO fields', { err: String(err) });
  }

  try {
    const notifyUrl = envOrProc('ZOHO_WEBHOOK_URL') ?? `${url.origin}/api/zoho/webhook`;
    const channelToken = envOrProc('ZOHO_CHANNEL_TOKEN') ?? 'zoho-channel-token';
    const channelId = String(Math.floor(1e12 + Math.random() * 9e12));
    logger.info('[exchange-token] registering webhook channel', { instanceId, notifyUrl, channelId });

    const ctx = await createZohoContext(instanceId);
    const channelExpiry = await registerWebhookChannel(ctx, notifyUrl, channelId, channelToken);

    await updateToken(instanceId, { channel_id: channelId, channel_expiry: channelExpiry });
    logger.info('[exchange-token] webhook channel registered', { instanceId, channelId, notifyUrl, channelExpiry });
  } catch (err) {
    logger.warn('[exchange-token] could not register ZOHO webhook channel', { err: String(err) });
  }

  logger.info('[exchange-token] connect complete', { instanceId, orgId });
  return Response.json({ success: true });
};
