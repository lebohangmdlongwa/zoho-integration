import {
  getFieldMappings,
  insertSyncLog,
  getIdMapByWixId,
  upsertIdMap,
  getSupabase,
  countSyncedContacts,
} from './_shared/db.ts';
import { getContactLimit, FREE_CONTACT_LIMIT } from './_shared/plan-limits.ts';
import {
  createZohoContext,
  buildZohoFields,
  createContact as zohoCreateContact,
  updateContact as zohoUpdateContact,
  searchContactByWixId as zohoSearchByWixId,
  searchContactByEmail as zohoSearchByEmail,
  extractWixField,
  zohoIntegrationFieldsExist,
  ensureIntegrationFields,
} from './zoho-client.ts';
import { logger } from './logger.ts';

export async function syncContactToZoho(
  instanceId: string,
  contactId: string,
  wixContact: Record<string, unknown>,
): Promise<void> {
  try {
    const syncId = crypto.randomUUID();
    const syncTs = Date.now();

    const { data: tokenRow } = instanceId
      ? await getSupabase()
          .from('zoho_tokens')
          .select('instance_id')
          .eq('instance_id', instanceId)
          .maybeSingle()
      : { data: null };

    if (!tokenRow) {
      logger.info('[wix-sync] skip: no ZOHO installation for this site', { instanceId });
      return;
    }

    const contactLimit = await getContactLimit();
    if (contactLimit <= FREE_CONTACT_LIMIT) {
      logger.info('[wix-sync] skip: free plan does not allow Wix→ZOHO sync', { instanceId, contactId });
      return;
    }

    const existing = await getIdMapByWixId(instanceId, contactId);
    if (existing) {
      const lastSyncMs = new Date(existing.last_synced_at).getTime();
      if (syncTs - lastSyncMs < 30_000) {
        logger.info('[wix-sync] skip: bounce guard', {
          contactId,
          ageSec: Math.round((syncTs - lastSyncMs) / 1000),
        });
        return;
      }
    }

    if (!existing) {
      const syncedCount = await countSyncedContacts(instanceId);
      if (syncedCount >= contactLimit) {
        logger.info('[wix-sync] skip: contact limit reached', { syncedCount, limit: contactLimit, contactId });
        return;
      }
    }

    const mappings = await getFieldMappings(instanceId);
    const ctx = await createZohoContext(instanceId);

    if (!(await zohoIntegrationFieldsExist(ctx))) {
      await ensureIntegrationFields(ctx).catch((err) =>
        logger.warn('[wix-sync] ensureIntegrationFields failed', { err: String(err) }),
      );
    }

    const fields = buildZohoFields(wixContact, mappings, syncTs);
    fields['Wix_Contact_Id'] = contactId;

    if (Object.keys(fields).length <= 2) {
      logger.info('[wix-sync] skip: no real mapped fields', { contactId });
      return;
    }

    // Zoho requires Last_Name on create. Apply fallback so contacts without
    // a last name still sync instead of being silently dropped.
    const ensureLastName = (f: Record<string, string>) => {
      if (!f['Last_Name']) {
        f['Last_Name'] = '(Unknown)';
      }
    };

    let zohoId: string;
    if (existing) {
      try {
        const result = await zohoUpdateContact(ctx, existing.zoho_id, fields);
        zohoId = result.details?.id ? String(result.details.id) : existing.zoho_id;
      } catch (updateErr) {
        if (String(updateErr).includes('404')) {
          logger.warn('[wix-sync] stale idMap, recreating in ZOHO', {
            wixId: contactId,
            staleZohoId: existing.zoho_id,
          });
          ensureLastName(fields);
          const created = await zohoCreateContact(ctx, fields);
          zohoId = String(created.details.id);
        } else {
          throw updateErr;
        }
      }
    } else {
      const zohoExistingById = await zohoSearchByWixId(ctx, contactId);
      if (zohoExistingById) {
        logger.info('[wix-sync] found in ZOHO by Wix_Contact_Id, updating', { contactId, zohoId: zohoExistingById.id });
        await zohoUpdateContact(ctx, zohoExistingById.id, fields);
        zohoId = zohoExistingById.id;
      } else {
        const email = extractWixField(wixContact, 'info.emails[0].email');
        const zohoExistingByEmail = email ? await zohoSearchByEmail(ctx, email) : null;
        if (zohoExistingByEmail) {
          logger.info('[wix-sync] found in ZOHO by email, updating', { contactId, zohoId: zohoExistingByEmail.id, email });
          await zohoUpdateContact(ctx, zohoExistingByEmail.id, fields);
          zohoId = zohoExistingByEmail.id;
        } else {
          ensureLastName(fields);
          const created = await zohoCreateContact(ctx, fields);
          if (created.code === 'DUPLICATE_DATA') {
            zohoId = String(created.details.id);
            await zohoUpdateContact(ctx, zohoId, fields);
          } else {
            zohoId = String(created.details.id);
          }
        }
      }
    }

    await upsertIdMap({
      instance_id: instanceId,
      wix_id: contactId,
      zoho_id: zohoId,
      entity_type: 'contact',
      last_sync_source: 'wix',
      last_sync_id: syncId,
    });

    await insertSyncLog({
      instance_id: instanceId,
      direction: 'wix_to_zoho',
      entity_type: 'contact',
      wix_id: contactId,
      zoho_id: zohoId,
      status: 'success',
      skip_reason: null,
      error_message: null,
      sync_id: syncId,
    });

    logger.info('[wix-sync] synced to ZOHO', { contactId, zohoId });
  } catch (err) {
    logger.error('[wix-sync] sync failed', { contactId, instanceId, err: String(err) });
    await insertSyncLog({
      instance_id: instanceId || 'unknown',
      direction: 'wix_to_zoho',
      entity_type: 'contact',
      wix_id: contactId,
      zoho_id: null,
      status: 'error',
      skip_reason: null,
      error_message: String(err),
      sync_id: 'unknown',
    }).catch(() => {});
  }
}

export function buildWixContactFromEntity(entity: any): Record<string, unknown> {
  const rawInfo = entity.info ?? {};
  const info = {
    ...rawInfo,
    name: rawInfo.name ?? {},
    company:
      typeof rawInfo.company === 'string'
        ? { name: rawInfo.company }
        : (rawInfo.company ?? undefined),
    emails: (rawInfo.emails?.items ?? []).map((e: any) => ({ email: e.email, tag: e.tag })),
    phones: (rawInfo.phones?.items ?? []).map((p: any) => ({ phone: p.phone, tag: p.tag })),
    addresses: (rawInfo.addresses?.items ?? []).map((a: any) => ({
      tag: a.tag,
      city: a.address?.city,
      country: a.address?.country,
      addressLine: a.address?.addressLine,
      addressLine2: a.address?.addressLine2,
      postalCode: a.address?.postalCode,
      subdivision: a.address?.subdivision,
    })),
  };
  return { id: entity._id ?? entity.id ?? '', info };
}
