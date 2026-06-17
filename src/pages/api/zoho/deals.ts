import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getDeals, getToken, updateToken } from '../../../backend/_shared/db.ts';
import { createZohoContext, getOrgId } from '../../../backend/zoho-client.ts';

export const GET: APIRoute = async (context) => {
  console.log('[deals] GET called');
  try {
    const tokenInfo = await auth.getTokenInfo();
    const instanceId = tokenInfo?.instanceId;
    if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const params = context.url.searchParams;
    const limit = Math.min(parseInt(params.get('limit') ?? '50', 10), 200);
    const offset = parseInt(params.get('offset') ?? '0', 10);

    const [{ deals, total }, token] = await Promise.all([
      getDeals(instanceId, limit, offset),
      getToken(instanceId),
    ]);

    // org_id may have been stored as the CRM record id (19 digits) instead of zgid (~11 digits).
    // Heal it transparently so deal URLs point to the right place.
    let orgId = token?.org_id ?? null;
    if (token && (!orgId || orgId.length > 15)) {
      try {
        const ctx = await createZohoContext(instanceId);
        const zgid = await getOrgId(ctx);
        if (zgid) {
          await updateToken(instanceId, { org_id: zgid });
          orgId = zgid;
          console.log('[deals] healed org_id to zgid', { zgid });
        }
      } catch (e) {
        console.warn('[deals] could not fetch zgid', String(e));
      }
    }

    return Response.json({ deals, total, orgId, apiDomain: token?.api_domain ?? null });
  } catch (err) {
    // Wix SDK SDKError has circular refs — never JSON.stringify(err) directly.
    // Actual error detail lives at err.response.data, not err.message (super() called with no args).
    const wixData = (err as any)?.response?.data;
    const wixCode = (err as any)?.response?.status;
    const detail =
      wixData?.details?.applicationError?.description ||
      wixData?.message ||
      (err instanceof Error ? err.message : null) ||
      String(err);
    const message = detail || `Wix API error (HTTP ${wixCode ?? 'unknown'})`;
    let rawStr = '';
    try { rawStr = JSON.stringify(wixData); } catch { rawStr = '(not serialisable)'; }
    console.error('[deals] GET failed', { code: wixCode, message, raw: rawStr });
    return Response.json({ error: message }, { status: 500 });
  }
};
