import { httpClient } from '@wix/essentials';
import { applyTransform } from './zoho-client.ts';

const WIX_EXTENDED_FIELDS_API = 'https://www.wixapis.com/contacts/v4/extended-fields';

// Per-process cache: "siteId:baseKey" → resolved key
const extFieldKeyCache = new Map<string, string>();

export async function resolveExtendedFieldKey(
  siteId: string,
  baseKey: string,
): Promise<string> {
  const cacheKey = `${siteId}:${baseKey}`;
  if (extFieldKeyCache.has(cacheKey)) return extFieldKeyCache.get(cacheKey)!;

  try {
    const res = await httpClient.fetchWithAuth(WIX_EXTENDED_FIELDS_API);
    if (!res.ok) return baseKey;
    const data = (await res.json()) as { fields?: { key: string }[] };
    for (const field of data.fields ?? []) {
      const k = field.key;
      const dashIdx = k.lastIndexOf('-');
      if (dashIdx > 0 && k.length - dashIdx - 1 >= 20 && k.slice(0, dashIdx) === baseKey) {
        extFieldKeyCache.set(cacheKey, k);
        return k;
      }
    }
  } catch {
    /* fall back to baseKey */
  }

  return baseKey;
}

// Builds a Wix contact `info` patch from ZOHO fields + field mappings.
export async function buildWixInfo(
  zohoFields: Record<string, string>,
  mappings: FieldMapping[],
  siteId?: string,
): Promise<Record<string, unknown>> {
  const applicable = mappings.filter(
    (m) => m.direction === 'zoho_to_wix' || m.direction === 'bidirectional',
  );

  const info: Record<string, unknown> = {};
  const extItems: Record<string, string> = {};

  for (const m of applicable) {
    const raw = zohoFields[m.zohoProp];
    if (!raw) continue;
    const value = applyTransform(raw, m.transform);

    if (m.wixField.startsWith('extendedFields.')) {
      const baseKey = m.wixField.slice('extendedFields.'.length);
      const actualKey = siteId ? await resolveExtendedFieldKey(siteId, baseKey) : baseKey;
      extItems[actualKey] = value;
      continue;
    }

    switch (m.wixField) {
      case 'info.name.first':
        (info.name as any) ??= {};
        (info.name as any).first = value;
        break;
      case 'info.name.last':
        (info.name as any) ??= {};
        (info.name as any).last = value;
        break;
      case 'info.emails[0].email':
        info.emails = { items: [{ email: value, tag: 'MAIN' }] };
        break;
      case 'info.phones[0].phone':
        info.phones = { items: [{ phone: value, tag: 'MAIN' }] };
        break;
      case 'info.company.name':
        info.company = { name: value };
        break;
      case 'info.jobTitle':
        info.jobTitle = value;
        break;
      case 'info.addresses[0].addressLine':
      case 'info.addresses[0].city':
      case 'info.addresses[0].country':
      case 'info.addresses[0].postalCode':
      case 'info.addresses[0].subdivision': {
        const field = m.wixField.split('.').pop()!;
        if (field === 'country' && !/^[A-Za-z]{2}$/.test(value)) break;
        if (!info.addresses) info.addresses = { items: [{ tag: 'HOME', address: {} }] };
        ((info.addresses as any).items[0].address as Record<string, string>)[field] = value;
        break;
      }
    }
  }

  if (Object.keys(extItems).length) {
    info.extendedFields = { items: extItems };
  }

  return info;
}
