import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getToken, updateToken } from '../../../backend/_shared/db.ts';
import { createZohoContext, registerWebhookChannel, deleteWebhookChannel } from '../../../backend/zoho-client.ts';
import { logger } from '../../../backend/logger.ts';

const envOrProc = (key: string) => (import.meta.env[key] ?? process.env[key]) as string | undefined;

export const POST: APIRoute = async ({ url }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const token = await getToken(instanceId);
  if (!token) return Response.json({ error: 'Not connected' }, { status: 400 });

  const notifyUrl = envOrProc('ZOHO_WEBHOOK_URL') ?? `${url.origin}/api/zoho/webhook`;
  const channelToken = envOrProc('ZOHO_CHANNEL_TOKEN') ?? 'zoho-channel-token';
  const channelId = String(Math.floor(1e12 + Math.random() * 9e12));

  try {
    const ctx = await createZohoContext(instanceId);

    // Delete the existing channel before registering a new one — prevents orphaned
    // channels accumulating when re-registering (e.g. after a DB reset)
    if (token.channel_id) {
      try {
        await deleteWebhookChannel(ctx, token.channel_id as string);
        logger.info('[register-webhook] deleted old channel', { instanceId, oldChannelId: token.channel_id });
      } catch (err) {
        logger.warn('[register-webhook] could not delete old channel — continuing', {
          instanceId, oldChannelId: token.channel_id, err: String(err),
        });
      }
    }

    await registerWebhookChannel(ctx, notifyUrl, channelId, channelToken);

    const channelExpiry = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, '+00:00');

    await updateToken(instanceId, { channel_id: channelId, channel_expiry: channelExpiry });

    logger.info('[register-webhook] channel registered', { instanceId, channelId, notifyUrl });
    return Response.json({ ok: true, channelId, notifyUrl });
  } catch (err) {
    logger.error('[register-webhook] failed', { err: String(err) });
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
