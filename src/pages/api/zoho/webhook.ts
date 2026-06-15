import type { APIRoute } from 'astro';
import { httpClient } from '@wix/essentials';
import {
  getSupabase,
  insertSyncLog,
  upsertIdMap,
  markEventProcessed,
  getIdMapByZohoId,
  getIdMapByWixId,
  getFieldMappings,
  getTokenByChannelId,
} from '../../../backend/_shared/db.ts';
import {
  createZohoContext,
  getContact as zohoGetContact,
  isOwnWrite,
} from '../../../backend/zoho-client.ts';
import { buildWixInfo } from '../../../backend/wix-field-builder.ts';
import { logger } from '../../../backend/logger.ts';

// ── ZOHO webhook payload types ────────────────────────────────────

type ZohoWebhookPayload = {
  channel_id?: string | number;
  query_params?: { channel_id?: string; subscription_id?: string };
  module?: string;
  operation?: 'insert' | 'update' | 'delete' | 'edit' | 'create';
  ids?: string[];
  token?: string;
};

// ── Wix REST helpers ──────────────────────────────────────────────

const WIX_CONTACTS_API = 'https://www.wixapis.com/contacts/v4/contacts';

function wixHeaders(siteId: string) {
  return { 'wix-site-id': siteId, 'Content-Type': 'application/json' };
}

async function wixGetContact(siteId: string, contactId: string) {
  const res = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${contactId}`, {
    headers: wixHeaders(siteId),
  });
  if (!res.ok) throw new Error(`Wix getContact ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { contact: { id: string; revision: number; info: Record<string, unknown> } };
  return data.contact;
}

async function wixUpdateContact(siteId: string, contactId: string, revision: number, info: Record<string, unknown>): Promise<void> {
  const res = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${contactId}`, {
    method: 'PATCH',
    headers: wixHeaders(siteId),
    body: JSON.stringify({ revision, info }),
  });
  if (res.status === 409) {
    const fresh = await wixGetContact(siteId, contactId);
    const retry = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${contactId}`, {
      method: 'PATCH',
      headers: wixHeaders(siteId),
      body: JSON.stringify({ revision: fresh.revision, info }),
    });
    if (!retry.ok) throw new Error(`Wix updateContact retry ${retry.status}: ${await retry.text()}`);
    return;
  }
  if (!res.ok) throw new Error(`Wix updateContact ${res.status}: ${await res.text()}`);
}

async function wixCreateContact(siteId: string, info: Record<string, unknown>): Promise<string | null> {
  const res = await httpClient.fetchWithAuth(WIX_CONTACTS_API, {
    method: 'POST',
    headers: wixHeaders(siteId),
    body: JSON.stringify({ info }),
  });
  if (!res.ok) throw new Error(`Wix createContact ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { contact?: { id?: string } };
  return data.contact?.id ?? null;
}

// ── Token verification ────────────────────────────────────────────

function validateToken(payload: ZohoWebhookPayload): boolean {
  const channelToken =
    (import.meta.env.ZOHO_CHANNEL_TOKEN ?? process.env.ZOHO_CHANNEL_TOKEN) as string | undefined;
  if (!channelToken) return true; // no env var configured — allow through (dev only)
  return payload.token === channelToken;
}

// ── Contact update helpers ────────────────────────────────────────

async function updateWixContactSafe(
  siteId: string,
  wixContactId: string,
  zohoFields: Record<string, string>,
  mappings: FieldMapping[],
): Promise<void> {
  const contact = await wixGetContact(siteId, wixContactId);
  const info = await buildWixInfo(zohoFields, mappings, siteId);
  if (!Object.keys(info).length) return;
  await wixUpdateContact(siteId, wixContactId, contact.revision, info);
}

async function createWixContactFromZoho(
  siteId: string,
  zohoFields: Record<string, string>,
  mappings: FieldMapping[],
): Promise<string | null> {
  const info = await buildWixInfo(zohoFields, mappings, siteId);
  if (!Object.keys(info).length) return null;
  return wixCreateContact(siteId, info);
}

// ── Main webhook handler ──────────────────────────────────────────

export async function handleZohoWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();

  // Probe: log every incoming request so we can confirm Zoho is delivering.
  // Uses the first available instance_id to satisfy any FK constraint.
  // Remove once webhook delivery is confirmed working.
  try {
    const { data: anyToken } = await getSupabase()
      .from('zoho_tokens')
      .select('instance_id')
      .limit(1)
      .maybeSingle();
    if (anyToken?.instance_id) {
      await getSupabase().from('sync_log').insert({
        instance_id: anyToken.instance_id,
        direction: 'zoho_to_wix',
        entity_type: 'contact',
        wix_id: null,
        zoho_id: null,
        status: 'skipped',
        skip_reason: 'webhook_probe',
        error_message: rawBody.slice(0, 500),
        sync_id: null,
      });
    }
  } catch { /* non-fatal */ }

  let payload: ZohoWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!validateToken(payload)) {
    logger.warn('[webhook] invalid ZOHO channel token');
    return new Response('Invalid token', { status: 401 });
  }

  // channel_id is a top-level field in the Zoho payload (not inside query_params)
  const channelId = String(payload.channel_id ?? payload.query_params?.channel_id ?? '');
  const operation = payload.operation;
  const ids = payload.ids ?? [];

  if (!channelId || !operation || !ids.length) {
    return Response.json({ ok: true });
  }

  if (payload.module !== 'Contacts') {
    return Response.json({ ok: true });
  }

  logger.info('[webhook] received', { operation, count: ids.length, channelId });

  // Look up installation by channel_id (ZOHO doesn't send org_id in payload)
  const tokenRow = await getTokenByChannelId(channelId);
  if (!tokenRow) {
    logger.warn('[webhook] no installation for channel', { channelId });
    return Response.json({ ok: true });
  }

  const instanceId = tokenRow.instance_id;
  const siteId = tokenRow.site_id;

  if (!siteId) {
    logger.warn('[webhook] missing site_id — reconnect in dashboard to fix', { instanceId });
    return Response.json({ ok: true });
  }

  for (const zohoId of ids) {
    const eventKey = `${channelId}:${operation}:${zohoId}`;
    const isNew = await markEventProcessed(eventKey);
    if (!isNew) {
      logger.info('[webhook] skip: already processed', { eventKey });
      continue;
    }

    try {
      const syncId = crypto.randomUUID();

      // ── Delete events ────────────────────────────────────────────
      if (operation === 'delete') {
        const idMap = await getIdMapByZohoId(instanceId, zohoId);
        if (idMap) {
          await insertSyncLog({
            instance_id: instanceId,
            direction: 'zoho_to_wix',
            entity_type: 'contact',
            wix_id: idMap.wix_id,
            zoho_id: zohoId,
            status: 'skipped',
            skip_reason: 'zoho_contact_deleted',
            error_message: null,
            sync_id: syncId,
          });
        }
        continue;
      }

      // ── Insert / update events ───────────────────────────────────
      const ctx = await createZohoContext(instanceId);
      const contact = await zohoGetContact(ctx, zohoId);

      if (!contact) {
        logger.info('[webhook] skip: ZOHO contact not found', { zohoId });
        continue;
      }

      const zohoFields = contact as Record<string, string>;

      // Correlation-ID guard: skip if this was our own write
      if (isOwnWrite(zohoFields.Wix_Sync_Source)) {
        logger.info('[webhook] skip: own write (correlation ID)', { zohoId });
        await insertSyncLog({
          instance_id: instanceId,
          direction: 'zoho_to_wix',
          entity_type: 'contact',
          wix_id: null,
          zoho_id: zohoId,
          status: 'skipped',
          skip_reason: 'own_write_correlation_id',
          error_message: null,
          sync_id: syncId,
        });
        continue;
      }

      const mappings = await getFieldMappings(instanceId);
      const idMap = await getIdMapByZohoId(instanceId, zohoId);

      if (idMap) {
        // DB timestamp guard
        const lastSyncMs = new Date(idMap.last_synced_at).getTime();
        if (idMap.last_sync_source === 'wix' && Date.now() - lastSyncMs < 5 * 60 * 1000) {
          logger.info('[webhook] skip: db timestamp guard', { zohoId, wixId: idMap.wix_id });
          await insertSyncLog({
            instance_id: instanceId,
            direction: 'zoho_to_wix',
            entity_type: 'contact',
            wix_id: idMap.wix_id,
            zoho_id: zohoId,
            status: 'skipped',
            skip_reason: 'db_timestamp_guard',
            error_message: null,
            sync_id: syncId,
          });
          continue;
        }

        await updateWixContactSafe(siteId, idMap.wix_id, zohoFields, mappings);
        await upsertIdMap({
          instance_id: instanceId,
          wix_id: idMap.wix_id,
          zoho_id: zohoId,
          entity_type: 'contact',
          last_sync_source: 'zoho',
          last_sync_id: syncId,
        });
        await insertSyncLog({
          instance_id: instanceId,
          direction: 'zoho_to_wix',
          entity_type: 'contact',
          wix_id: idMap.wix_id,
          zoho_id: zohoId,
          status: 'success',
          skip_reason: null,
          error_message: null,
          sync_id: syncId,
        });
        logger.info('[webhook] updated Wix contact', { wixId: idMap.wix_id, zohoId });
      } else {
        const existingWixId = zohoFields.Wix_Contact_Id;

        let targetWixId: string;

        if (existingWixId) {
          const reverseMap = await getIdMapByWixId(instanceId, existingWixId);
          if (!reverseMap) {
            logger.info('[webhook] skip: sync link was manually removed', { existingWixId, zohoId });
            await insertSyncLog({
              instance_id: instanceId,
              direction: 'zoho_to_wix',
              entity_type: 'contact',
              wix_id: existingWixId,
              zoho_id: zohoId,
              status: 'skipped',
              skip_reason: 'sync_link_removed',
              error_message: null,
              sync_id: syncId,
            });
            continue;
          }

          await updateWixContactSafe(siteId, existingWixId, zohoFields, mappings);
          targetWixId = existingWixId;
        } else if (zohoFields.Wix_Sync_Source?.startsWith('wix_sync_')) {
          logger.info('[webhook] skip: Wix-origin contact has no Wix_Contact_Id', { zohoId });
          await insertSyncLog({
            instance_id: instanceId,
            direction: 'zoho_to_wix',
            entity_type: 'contact',
            wix_id: null,
            zoho_id: zohoId,
            status: 'skipped',
            skip_reason: 'wix_origin_no_id',
            error_message: null,
            sync_id: syncId,
          });
          continue;
        } else {
          const newWixId = await createWixContactFromZoho(siteId, zohoFields, mappings);
          if (!newWixId) {
            await insertSyncLog({
              instance_id: instanceId,
              direction: 'zoho_to_wix',
              entity_type: 'contact',
              wix_id: null,
              zoho_id: zohoId,
              status: 'skipped',
              skip_reason: 'no_mapped_fields',
              error_message: null,
              sync_id: syncId,
            });
            continue;
          }
          targetWixId = newWixId;
          logger.info('[webhook] created new Wix contact from ZOHO', { newWixId, zohoId });
        }

        await upsertIdMap({
          instance_id: instanceId,
          wix_id: targetWixId,
          zoho_id: zohoId,
          entity_type: 'contact',
          last_sync_source: 'zoho',
          last_sync_id: syncId,
        });
        await insertSyncLog({
          instance_id: instanceId,
          direction: 'zoho_to_wix',
          entity_type: 'contact',
          wix_id: targetWixId,
          zoho_id: zohoId,
          status: 'success',
          skip_reason: null,
          error_message: null,
          sync_id: syncId,
        });
      }
    } catch (err) {
      logger.error('[webhook] event processing failed', { zohoId, err: String(err) });
      try {
        await insertSyncLog({
          instance_id: instanceId,
          direction: 'zoho_to_wix',
          entity_type: 'contact',
          wix_id: null,
          zoho_id: zohoId,
          status: 'error',
          skip_reason: null,
          error_message: String(err),
          sync_id: null,
        });
      } catch {
        /* suppress */
      }
    }
  }

  return Response.json({ ok: true });
}

export const POST: APIRoute = async ({ request }) => handleZohoWebhook(request);
