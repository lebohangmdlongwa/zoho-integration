import type { APIRoute } from 'astro';
import { auth, httpClient } from '@wix/essentials';
import { createZohoContext, ensureCustomField } from '../../../backend/zoho-client.ts';
import { logger } from '../../../backend/logger.ts';

// Per-process cache: avoids redundant API calls on repeat saves in the same server session.
const sessionProvisioned = new Set<string>();

// Wix standard field prefixes — no extended-field creation needed for these
const WIX_STANDARD_PREFIXES = ['info.', 'primaryInfo.', 'name.'];

// ZOHO built-in contact fields — no creation needed
const STANDARD_ZOHO_FIELDS = new Set([
  'First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile',
  'Account_Name', 'Title', 'Department', 'Lead_Source',
  'Mailing_Street', 'Mailing_City', 'Mailing_State', 'Mailing_Zip', 'Mailing_Country',
  'Description', 'Website', 'Fax', 'Twitter', 'Skype_ID',
  // Integration fields created at connect-time
  'Wix_Contact_Id', 'Wix_Sync_Source',
]);

function isStandardWixField(path: string): boolean {
  return WIX_STANDARD_PREFIXES.some((p) => path.startsWith(p));
}

function normalizeWixCustomField(raw: string): { path: string; key: string } {
  if (raw.startsWith('extendedFields.')) {
    const key = raw.replace(/^extendedFields\./, '');
    return { path: raw, key };
  }
  if (raw.startsWith('custom.')) {
    return { path: `extendedFields.${raw}`, key: raw };
  }
  return { path: `extendedFields.custom.${raw}`, key: `custom.${raw}` };
}

function toLabel(name: string): string {
  return name
    .replace(/^custom\./, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function createWixExtendedField(key: string, displayName: string): Promise<boolean> {
  const res = await httpClient.fetchWithAuth(
    'https://www.wixapis.com/contacts/v4/extended-fields',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, displayName, dataType: 'TEXT' }),
    },
  );
  if (res.ok) return true;
  const body = await res.text();
  if (res.status === 409) return false;
  throw new Error(`Wix extended field create failed (${res.status}): ${body}`);
}

export const POST: APIRoute = async ({ request }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { mappings } = (await request.json()) as { mappings: FieldMapping[] };
  if (!Array.isArray(mappings)) return Response.json({ error: 'Missing mappings' }, { status: 400 });

  let ctx;
  try {
    ctx = await createZohoContext(instanceId);
  } catch {
    return Response.json({ error: 'ZOHO CRM not connected' }, { status: 400 });
  }

  const normalizedMappings: FieldMapping[] = [];
  const provisioned: string[] = [];
  const errors: string[] = [];

  for (const m of mappings) {
    let normalizedWixField = m.wixField;

    // ── Wix field ─────────────────────────────────────────────────
    if (!isStandardWixField(m.wixField) && m.wixField.trim()) {
      const { path, key } = normalizeWixCustomField(m.wixField.trim());
      normalizedWixField = path;

      const wixCacheKey = `${instanceId}:wix:${key}`;
      if (!sessionProvisioned.has(wixCacheKey)) {
        try {
          const created = await createWixExtendedField(key, toLabel(key));
          sessionProvisioned.add(wixCacheKey);
          if (created) {
            provisioned.push(`Wix: ${key}`);
            logger.info('[ensure-fields] created Wix extended field', { key, instanceId });
          }
        } catch (err) {
          errors.push(`Wix field "${key}": ${String(err)}`);
          logger.error('[ensure-fields] Wix field error', { key, err: String(err) });
        }
      }
    }

    // ── ZOHO field ────────────────────────────────────────────────
    const zohoProp = m.zohoProp.trim();
    if (zohoProp && !STANDARD_ZOHO_FIELDS.has(zohoProp)) {
      const zohoCacheKey = `${instanceId}:zoho:${zohoProp}`;
      if (!sessionProvisioned.has(zohoCacheKey)) {
        try {
          const created = await ensureCustomField(ctx, toLabel(zohoProp));
          sessionProvisioned.add(zohoCacheKey);
          if (created) {
            provisioned.push(`ZOHO: ${zohoProp}`);
            logger.info('[ensure-fields] created ZOHO field', { zohoProp, instanceId });
          }
        } catch (err) {
          errors.push(`ZOHO field "${zohoProp}": ${String(err)}`);
          logger.error('[ensure-fields] ZOHO field error', { zohoProp, err: String(err) });
        }
      }
    }

    normalizedMappings.push({ ...m, wixField: normalizedWixField });
  }

  return Response.json({ mappings: normalizedMappings, provisioned, errors });
};
