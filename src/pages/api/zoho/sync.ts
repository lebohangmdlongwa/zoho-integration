import type { APIRoute } from 'astro';
import { auth, httpClient } from '@wix/essentials';
import {
  getFieldMappings,
  getAllIdMaps,
  upsertIdMap,
  batchInsertSyncLog,
  batchUpsertIdMap,
} from '../../../backend/_shared/db.ts';
import {
  createZohoContext,
  buildZohoFields,
  createContact as zohoCreateContact,
  updateContact as zohoUpdateContact,
  fetchContactsPage,
  batchUpdateZohoContacts,
  batchUpsertZohoContactsByEmail,
  searchContactByWixId,
  applyTransform,
} from '../../../backend/zoho-client.ts';
import { logger } from '../../../backend/logger.ts';
import { getContactLimit, FREE_CONTACT_LIMIT } from '../../../backend/_shared/plan-limits.ts';

const WIX_CONTACTS_API = 'https://www.wixapis.com/contacts/v4/contacts';
const WIX_EXTENDED_FIELDS_API = 'https://www.wixapis.com/contacts/v4/extended-fields';

// ── Wix REST helpers ──────────────────────────────────────────────

async function fetchWixExtendedFieldKeyMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await httpClient.fetchWithAuth(WIX_EXTENDED_FIELDS_API);
    if (!res.ok) return map;
    const data = (await res.json()) as { fields?: { key: string }[] };
    for (const field of data.fields ?? []) {
      const key = field.key;
      const dashIdx = key.lastIndexOf('-');
      if (dashIdx > 0 && key.length - dashIdx - 1 >= 20) map.set(key.slice(0, dashIdx), key);
      map.set(key, key);
    }
  } catch {
    /* ignore */
  }
  return map;
}

async function fetchAllWixContacts(): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(WIX_CONTACTS_API);
    url.searchParams.set('paging.limit', '100');
    if (cursor) url.searchParams.set('paging.cursor', cursor);

    const res = await httpClient.fetchWithAuth(url.toString());
    if (!res.ok) throw new Error(`Wix Contacts API ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      contacts?: Record<string, unknown>[];
      pagingMetadata?: { cursors?: { next?: string } };
    };

    for (const c of data.contacts ?? []) {
      const info = (c.info as Record<string, unknown>) ?? {};
      all.push({
        ...c,
        info: {
          ...info,
          emails: (info.emails as any)?.items ?? info.emails ?? [],
          phones: (info.phones as any)?.items ?? info.phones ?? [],
          company:
            typeof info.company === 'string'
              ? { name: info.company }
              : (info.company ?? undefined),
          addresses: ((info.addresses as any)?.items ?? info.addresses ?? []).map((a: any) => ({
            tag: a.tag,
            addressLine: a.address?.addressLine ?? a.addressLine ?? '',
            city: a.address?.city ?? a.city ?? '',
            country: a.address?.country ?? a.country ?? '',
            postalCode: a.address?.postalCode ?? a.postalCode ?? '',
            subdivision: a.address?.subdivision ?? a.subdivision ?? '',
          })),
        },
      });
    }
    cursor = data.pagingMetadata?.cursors?.next ?? undefined;
  } while (cursor);
  return all;
}

// ── Main handler ──────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  // phase=1 → Wix→ZOHO only
  // phase=2 → ZOHO→Wix page (paginated, may need multiple calls)
  // phase=2&page=N → next page of ZOHO→Wix
  const url = new URL(request.url);
  const phase = url.searchParams.get('phase');
  const zohoPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const ZOHO_PAGE_SIZE = 15;

  logger.info('[sync] POST started', { phase, zohoPage });

  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  let ctx;
  try {
    ctx = await createZohoContext(instanceId);
  } catch (err) {
    return Response.json({ error: 'ZOHO CRM not connected' }, { status: 401 });
  }

  const mappings = await getFieldMappings(instanceId);
  const contactLimit = await getContactLimit();
  const isFreePlan = contactLimit <= FREE_CONTACT_LIMIT;

  const syncRunId = crypto.randomUUID();
  const stats = { wixToZoho: 0, zohoToWix: 0, skipped: 0, limitSkipped: 0, errors: 0 };
  const errorLog: { phase: string; id: string; err: string }[] = [];

  const existingIdMaps = await getAllIdMaps(instanceId);
  const idMapByWixId = new Map(existingIdMaps.map((m) => [m.wix_id, m]));
  const idMapByZohoId = new Map(existingIdMaps.map((m) => [m.zoho_id, m]));

  const syncLogBatch: Omit<SyncLogRow, 'id' | 'synced_at'>[] = [];

  // ── Phase 1: Wix → ZOHO ─────────────────────────────────────────
  const wixToZohoMaps = mappings.filter(
    (m) => m.direction === 'wix_to_zoho' || m.direction === 'bidirectional',
  );

  if (wixToZohoMaps.length > 0 && phase !== '2' && !isFreePlan) {
    logger.info('[sync] Phase 1: Wix → ZOHO (batch)');

    let allWixContacts: Record<string, unknown>[];
    try {
      allWixContacts = await fetchAllWixContacts();
    } catch (err) {
      return Response.json({ error: `Failed to fetch Wix contacts: ${err}` }, { status: 502 });
    }

    if (allWixContacts.length > contactLimit) {
      return Response.json({ error: 'contact_limit_exceeded', limit: contactLimit, count: allWixContacts.length }, { status: 403 });
    }

    const syncTs = Date.now();
    const knownInputs: Array<{ zohoId: string; wixId: string; fields: Record<string, string> }> = [];
    const newWithEmail: Array<{ wixId: string; fields: Record<string, string> }> = [];
    const newWithoutEmail: Array<{ wixId: string; fields: Record<string, string> }> = [];

    for (const contact of allWixContacts) {
      const wixId = contact.id as string;
      const fields = buildZohoFields(contact, wixToZohoMaps, syncTs);
      fields['Wix_Contact_Id'] = wixId;
      if (Object.keys(fields).length <= 2) { stats.skipped++; continue; }

      const existing = idMapByWixId.get(wixId);
      if (existing) {
        knownInputs.push({ zohoId: existing.zoho_id, wixId, fields });
      } else if (fields['Email']) {
        newWithEmail.push({ wixId, fields });
      } else {
        newWithoutEmail.push({ wixId, fields });
      }
    }

    // Batch UPDATE known contacts
    if (knownInputs.length > 0) {
      try {
        await batchUpdateZohoContacts(ctx, knownInputs.map(({ zohoId, fields }) => ({ zohoId, fields })));
        for (const { zohoId, wixId } of knownInputs) {
          await upsertIdMap({ instance_id: instanceId, wix_id: wixId, zoho_id: zohoId, entity_type: 'contact', last_sync_source: 'wix', last_sync_id: syncRunId });
          syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: zohoId, status: 'success', skip_reason: null, error_message: null, sync_id: syncRunId });
          stats.wixToZoho++;
        }
      } catch (err) {
        const errStr = String(err);
        for (const { wixId } of knownInputs) {
          errorLog.push({ phase: 'wix_to_zoho', id: wixId, err: errStr });
          syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: null, status: 'error', skip_reason: null, error_message: errStr, sync_id: syncRunId });
          stats.errors++;
        }
      }
    }

    // Batch UPSERT new contacts by email
    if (newWithEmail.length > 0) {
      try {
        const emailMap = await batchUpsertZohoContactsByEmail(ctx, newWithEmail.map(({ fields }) => ({ fields })));
        for (const { wixId } of newWithEmail) {
          const zohoId = emailMap.get(wixId);
          if (zohoId) {
            await upsertIdMap({ instance_id: instanceId, wix_id: wixId, zoho_id: zohoId, entity_type: 'contact', last_sync_source: 'wix', last_sync_id: syncRunId });
            syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: zohoId, status: 'success', skip_reason: null, error_message: null, sync_id: syncRunId });
            stats.wixToZoho++;
          } else {
            syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: null, status: 'error', skip_reason: null, error_message: 'ZOHO upsert did not return an ID', sync_id: syncRunId });
            stats.errors++;
          }
        }
      } catch (err) {
        const errStr = String(err);
        for (const { wixId } of newWithEmail) {
          errorLog.push({ phase: 'wix_to_zoho', id: wixId, err: errStr });
          syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: null, status: 'error', skip_reason: null, error_message: errStr, sync_id: syncRunId });
          stats.errors++;
        }
      }
    }

    // Individual CREATE for contacts without email
    for (const { wixId, fields } of newWithoutEmail) {
      try {
        const existingZoho = await searchContactByWixId(ctx, wixId);
        let zohoId: string;
        if (existingZoho) {
          await zohoUpdateContact(ctx, existingZoho.id, fields);
          zohoId = existingZoho.id;
        } else {
          const result = await zohoCreateContact(ctx, fields);
          zohoId = String(result.details.id);
        }
        await upsertIdMap({ instance_id: instanceId, wix_id: wixId, zoho_id: zohoId, entity_type: 'contact', last_sync_source: 'wix', last_sync_id: syncRunId });
        syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: zohoId, status: 'success', skip_reason: null, error_message: null, sync_id: syncRunId });
        stats.wixToZoho++;
      } catch (err) {
        const errStr = String(err);
        errorLog.push({ phase: 'wix_to_zoho', id: wixId, err: errStr });
        syncLogBatch.push({ instance_id: instanceId, direction: 'wix_to_zoho', entity_type: 'contact', wix_id: wixId, zoho_id: null, status: 'error', skip_reason: null, error_message: errStr, sync_id: syncRunId });
        stats.errors++;
      }
    }
  }

  // ── Phase 2: ZOHO → Wix (page-based pagination) ─────────────────
  const zohoToWixMaps = mappings.filter(
    (m) => m.direction === 'zoho_to_wix' || m.direction === 'bidirectional',
  );

  let hasMore = false;
  let newZohoContactCount = 0;
  const phase2IdMapBatch: Omit<IdMapRow, 'last_synced_at'>[] = [];
  const noEmailNoZohoIdByName = new Map<string, string>();

  if (zohoToWixMaps.length > 0 && phase !== '1') {
    logger.info('[sync] Phase 2: ZOHO → Wix', { zohoPage });

    let zohoPage2: ZohoContact[];
    try {
      const result = await fetchContactsPage(ctx, { page: zohoPage, perPage: ZOHO_PAGE_SIZE });
      zohoPage2 = result.contacts;
      hasMore = result.hasMore;
    } catch (err) {
      return Response.json({ error: `Failed to fetch ZOHO contacts: ${err}` }, { status: 502 });
    }

    const wixFieldKeyMap = await fetchWixExtendedFieldKeyMap();

    for (const zohoContact of zohoPage2) {
      const syncId = syncRunId;
      const existingMap = idMapByZohoId.get(zohoContact.id);

      if (!existingMap) {
        const currentTotal = existingIdMaps.length + newZohoContactCount;
        if (currentTotal >= contactLimit) {
          stats.skipped++;
          stats.limitSkipped++;
          syncLogBatch.push({ instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact', wix_id: null, zoho_id: zohoContact.id, status: 'skipped', skip_reason: 'contact_limit_exceeded', error_message: null, sync_id: syncRunId });
          continue;
        }
        newZohoContactCount++;
      }

      try {
        const info: Record<string, unknown> = {};
        for (const m of zohoToWixMaps) {
          const raw = (zohoContact as Record<string, string | undefined>)[m.zohoProp];
          if (raw === null || raw === undefined || typeof raw === 'object') continue;
          const coerced = String(raw).trim();
          if (!coerced) continue;
          const value = applyTransform(coerced, m.transform);

          if (m.wixField.startsWith('extendedFields.')) {
            const baseKey = m.wixField.slice('extendedFields.'.length);
            const actualKey = wixFieldKeyMap.get(baseKey) ?? baseKey;
            if (!info.extendedFields) info.extendedFields = { items: {} as Record<string, string> };
            ((info.extendedFields as any).items as Record<string, string>)[actualKey] = value;
          } else {
            const parts = m.wixField.replace('info.', '').replace(/\[(\d+)\]/g, '.$1').split('.');
            if (parts[0] === 'name') {
              (info.name as any) ??= {};
              (info.name as any)[parts[1]] = value;
            } else if (parts[0] === 'emails') {
              info.emails = { items: [{ email: value, tag: 'MAIN' }] };
            } else if (parts[0] === 'phones') {
              info.phones = { items: [{ phone: value, tag: 'MAIN' }] };
            } else if (parts[0] === 'company') {
              info.company = value;
            } else if (parts[0] === 'jobTitle') {
              info.jobTitle = value;
            } else if (parts[0] === 'addresses') {
              const field = parts[2];
              if (field) {
                if (field === 'country' && !/^[A-Za-z]{2}$/.test(value)) continue;
                if (!info.addresses) info.addresses = { items: [{ tag: 'HOME', address: {} }] };
                ((info.addresses as any).items[0].address as Record<string, string>)[field] = value;
              }
            }
          }
        }

        if (Object.keys(info).length === 0) {
          stats.skipped++;
          syncLogBatch.push({ instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact', wix_id: existingMap?.wix_id ?? null, zoho_id: zohoContact.id, status: 'skipped', skip_reason: 'no_mapped_fields', error_message: null, sync_id: syncId });
          continue;
        }

        const JSON_HEADERS = { 'Content-Type': 'application/json' };
        let wixId: string;

        if (existingMap) {
          const getRes = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${existingMap.wix_id}`);
          if (getRes.status === 404) {
            const createRes = await httpClient.fetchWithAuth(WIX_CONTACTS_API, {
              method: 'POST',
              headers: JSON_HEADERS,
              body: JSON.stringify({ info }),
            });
            if (!createRes.ok) throw new Error(`Wix POST ${createRes.status}: ${await createRes.text()}`);
            const { contact: newC } = (await createRes.json()) as { contact?: { id?: string } };
            wixId = newC?.id ?? '';
          } else {
            if (!getRes.ok) throw new Error(`Wix GET ${getRes.status}: ${await getRes.text()}`);
            const { contact: curr } = (await getRes.json()) as { contact?: { revision?: string | number } };
            const patchRes = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${existingMap.wix_id}`, {
              method: 'PATCH',
              headers: JSON_HEADERS,
              body: JSON.stringify({ revision: String(curr?.revision ?? '1'), info }),
            });
            if (!patchRes.ok) throw new Error(`Wix PATCH ${patchRes.status}: ${await patchRes.text()}`);
            wixId = existingMap.wix_id;
          }
        } else {
          const knownWixId = zohoContact.Wix_Contact_Id;
          const zohoEmail = zohoContact.Email?.trim();
          let resolved: string | null = null;

          const zohoFirst = (zohoContact.First_Name ?? '').trim();
          const zohoLast = (zohoContact.Last_Name ?? '').trim();
          const nameKey = !zohoEmail && !knownWixId && (zohoFirst || zohoLast)
            ? `${zohoFirst}|${zohoLast}`.toLowerCase()
            : null;

          if (nameKey && noEmailNoZohoIdByName.has(nameKey)) {
            const dupeWixId = noEmailNoZohoIdByName.get(nameKey)!;
            newZohoContactCount--;
            await zohoUpdateContact(ctx, zohoContact.id, { Wix_Contact_Id: dupeWixId }).catch((e) =>
              logger.warn('[sync] Phase 2: failed to stamp Wix_Contact_Id on ZOHO duplicate', { zohoId: zohoContact.id, err: String(e) })
            );
            phase2IdMapBatch.push({ instance_id: instanceId, wix_id: dupeWixId, zoho_id: zohoContact.id, entity_type: 'contact', last_sync_source: 'zoho', last_sync_id: syncId });
            syncLogBatch.push({ instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact', wix_id: dupeWixId, zoho_id: zohoContact.id, status: 'skipped', skip_reason: 'zoho_no_key_duplicate', error_message: null, sync_id: syncId });
            stats.skipped++;
            continue;
          }

          if (knownWixId) {
            const p1Mapping = idMapByWixId.get(knownWixId);
            if (p1Mapping && p1Mapping.zoho_id !== zohoContact.id) {
              newZohoContactCount--;
              stats.skipped++;
              syncLogBatch.push({ instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact', wix_id: knownWixId, zoho_id: zohoContact.id, status: 'skipped', skip_reason: 'wix_id_claimed_by_other_zoho_contact', error_message: null, sync_id: syncRunId });
              continue;
            }

            const checkRes = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${knownWixId}`);
            if (checkRes.ok) {
              const { contact: curr } = (await checkRes.json()) as { contact?: { revision?: string | number } };
              const retryRes = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${knownWixId}`, {
                method: 'PATCH',
                headers: JSON_HEADERS,
                body: JSON.stringify({ revision: String(curr?.revision ?? '1'), info }),
              });
              if (!retryRes.ok) throw new Error(`Wix PATCH ${retryRes.status}: ${await retryRes.text()}`);
              resolved = knownWixId;
            }
          }

          if (!resolved) {
            const createRes = await httpClient.fetchWithAuth(WIX_CONTACTS_API, {
              method: 'POST',
              headers: JSON_HEADERS,
              body: JSON.stringify({ info }),
            });
            if (!createRes.ok) {
              const errText = await createRes.text();
              if (createRes.status === 409) {
                try {
                  const errBody = JSON.parse(errText) as { details?: { applicationError?: { data?: { duplicateContactId?: string } } } };
                  const dupId = errBody?.details?.applicationError?.data?.duplicateContactId;
                  if (dupId) {
                    const getRes = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${dupId}`);
                    if (getRes.ok) {
                      const { contact: curr } = (await getRes.json()) as { contact?: { revision?: string | number } };
                      const patchRes = await httpClient.fetchWithAuth(`${WIX_CONTACTS_API}/${dupId}`, {
                        method: 'PATCH',
                        headers: JSON_HEADERS,
                        body: JSON.stringify({ revision: String(curr?.revision ?? '1'), info }),
                      });
                      if (!patchRes.ok) throw new Error(`Wix PATCH ${patchRes.status}: ${await patchRes.text()}`);
                      resolved = dupId;
                    }
                  }
                } catch (parseErr) { /* fall through */ }
                if (!resolved) throw new Error(`Wix POST ${createRes.status}: ${errText}`);
              } else {
                throw new Error(`Wix POST ${createRes.status}: ${errText}`);
              }
            } else {
              const { contact: newC } = (await createRes.json()) as { contact?: { id?: string } };
              resolved = newC?.id ?? '';
            }
          }

          wixId = resolved!;

          if (nameKey) noEmailNoZohoIdByName.set(nameKey, wixId);

          if (!knownWixId) {
            await zohoUpdateContact(ctx, zohoContact.id, { Wix_Contact_Id: wixId }).catch((e) =>
              logger.warn('[sync] Phase 2: failed to stamp Wix_Contact_Id', { zohoId: zohoContact.id, err: String(e) })
            );
          }
        }

        await upsertIdMap({
          instance_id: instanceId,
          wix_id: wixId,
          zoho_id: zohoContact.id,
          entity_type: 'contact',
          last_sync_source: 'zoho',
          last_sync_id: syncId,
        }).catch((e) => logger.warn('[sync] Phase 2: immediate idMap write failed', { wixId, zohoId: zohoContact.id, err: String(e) }));

        phase2IdMapBatch.push({ instance_id: instanceId, wix_id: wixId, zoho_id: zohoContact.id, entity_type: 'contact', last_sync_source: 'zoho', last_sync_id: syncId });
        syncLogBatch.push({ instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact', wix_id: wixId, zoho_id: zohoContact.id, status: 'success', skip_reason: null, error_message: null, sync_id: syncId });
        stats.zohoToWix++;
      } catch (err) {
        const errStr = String(err);
        logger.error('[sync] ZOHO→Wix contact failed', { zohoId: zohoContact.id, err: errStr });
        errorLog.push({ phase: 'zoho_to_wix', id: zohoContact.id, err: errStr });
        syncLogBatch.push({ instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact', wix_id: existingMap?.wix_id ?? null, zoho_id: zohoContact.id, status: 'error', skip_reason: null, error_message: errStr, sync_id: syncRunId });
        stats.errors++;
      }
    }
  }

  const dedupedPhase2IdMapBatch = Array.from(
    new Map(phase2IdMapBatch.map((r) => [`${r.instance_id}|${r.wix_id}|${r.entity_type}`, r])).values(),
  );

  await Promise.all([
    batchUpsertIdMap(dedupedPhase2IdMapBatch),
    batchInsertSyncLog(syncLogBatch),
  ]);

  logger.info('[sync] complete', { ...stats, errorCount: errorLog.length });
  return Response.json({
    ...stats,
    errorLog,
    hasMore,
    nextPage: hasMore ? zohoPage + 1 : null,
    wixToZohoBlocked: isFreePlan,
  }) as Response;
};
