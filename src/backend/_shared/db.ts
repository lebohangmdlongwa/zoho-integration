export { getSupabase } from './supabase-client';
import { getSupabase } from './supabase-client';

// ── Token helpers ─────────────────────────────────────────────────

export async function getToken(instanceId: string): Promise<StoredToken | null> {
  const { data } = await getSupabase()
    .from('zoho_tokens')
    .select('*')
    .eq('instance_id', instanceId)
    .single();
  return data ?? null;
}

export async function getTokenByChannelId(channelId: string): Promise<StoredToken | null> {
  const { data } = await getSupabase()
    .from('zoho_tokens')
    .select('*')
    .eq('channel_id', channelId)
    .single();
  return data ?? null;
}

export async function upsertToken(token: StoredToken): Promise<void> {
  await getSupabase()
    .from('zoho_tokens')
    .upsert(token, { onConflict: 'instance_id' });
}

export async function updateToken(instanceId: string, patch: Partial<StoredToken>): Promise<void> {
  await getSupabase()
    .from('zoho_tokens')
    .update(patch)
    .eq('instance_id', instanceId);
}

export async function deleteToken(instanceId: string): Promise<void> {
  await getSupabase()
    .from('zoho_tokens')
    .delete()
    .eq('instance_id', instanceId);
}

// ── Sync log helpers ──────────────────────────────────────────────

export async function insertSyncLog(
  entry: Omit<SyncLogRow, 'id' | 'synced_at'>,
): Promise<void> {
  const { error } = await getSupabase()
    .from('sync_log')
    .insert({ ...entry, synced_at: new Date().toISOString() });
  if (error) {
    console.error('[supabase] insertSyncLog failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      entry_status: entry.status,
      entry_direction: entry.direction,
      wix_id: entry.wix_id,
      zoho_id: entry.zoho_id,
    });
  }
}

export async function getSyncLog(instanceId: string, limit = 20): Promise<SyncLogRow[]> {
  const { data } = await getSupabase()
    .from('sync_log')
    .select('*')
    .eq('instance_id', instanceId)
    .order('synced_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function countSyncLog(
  instanceId: string,
  filter: { direction?: string; status?: string },
): Promise<number> {
  let query = getSupabase()
    .from('sync_log')
    .select('*', { count: 'exact', head: true })
    .eq('instance_id', instanceId);
  if (filter.direction) query = query.eq('direction', filter.direction);
  if (filter.status)    query = query.eq('status', filter.status);
  const { count } = await query;
  return count ?? 0;
}

export async function countSyncedContacts(instanceId: string): Promise<number> {
  const { count } = await getSupabase()
    .from('contact_id_map')
    .select('*', { count: 'exact', head: true })
    .eq('instance_id', instanceId)
    .eq('entity_type', 'contact');
  return count ?? 0;
}

export async function countSyncedDeals(instanceId: string): Promise<number> {
  const { count } = await getSupabase()
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('instance_id', instanceId);
  return count ?? 0;
}

export interface DealRow {
  id: string;
  instance_id: string;
  zoho_deal_id: string;
  deal_name: string | null;
  stage: string | null;
  amount: number | null;
  closing_date: string | null;
  probability: number | null;
  expected_revenue: number | null;
  deal_type: string | null;
  next_step: string | null;
  lead_source: string | null;
  description: string | null;
  contact_name: string | null;
  zoho_contact_id: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export async function getDeals(
  instanceId: string,
  limit = 50,
  offset = 0,
): Promise<{ deals: DealRow[]; total: number }> {
  const builder = getSupabase()
    .from('deals')
    .select('*', { count: 'exact' })
    .eq('instance_id', instanceId)
    .order('closing_date', { ascending: true });
  // Cast needed because untyped createClient() returns SupabaseFilterBuilder which lacks .range()
  const { data, count, error } = await (builder as any).range(offset, offset + limit - 1);
  if (error) throw new Error(`getDeals: ${(error as any).message}`);
  return { deals: (data ?? []) as DealRow[], total: count ?? 0 };
}

// ── ID map helpers ────────────────────────────────────────────────

export async function getIdMapByWixId(
  instanceId: string,
  wixId: string,
): Promise<IdMapRow | null> {
  const { data } = await getSupabase()
    .from('contact_id_map')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('wix_id', wixId)
    .single();
  return data ?? null;
}

export async function getIdMapByZohoId(
  instanceId: string,
  zohoId: string,
): Promise<IdMapRow | null> {
  const { data } = await getSupabase()
    .from('contact_id_map')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('zoho_id', zohoId)
    .single();
  return data ?? null;
}

export async function deleteIdMapByWixId(
  instanceId: string,
  wixId: string,
): Promise<void> {
  await getSupabase()
    .from('contact_id_map')
    .delete()
    .eq('instance_id', instanceId)
    .eq('wix_id', wixId)
    .eq('entity_type', 'contact');
}

export async function getAllIdMaps(instanceId: string): Promise<IdMapRow[]> {
  const { data } = await getSupabase()
    .from('contact_id_map')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('entity_type', 'contact');
  return data ?? [];
}

export async function upsertIdMap(row: Omit<IdMapRow, 'last_synced_at'>): Promise<void> {
  await getSupabase()
    .from('contact_id_map')
    .upsert(
      { ...row, last_synced_at: new Date().toISOString() },
      { onConflict: 'instance_id,wix_id,entity_type' },
    );
}

export async function batchInsertSyncLog(
  entries: Omit<SyncLogRow, 'id' | 'synced_at'>[],
): Promise<void> {
  if (!entries.length) return;
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from('sync_log')
    .insert(entries.map((e) => ({ ...e, synced_at: now })));
  if (error) console.error('[supabase] batchInsertSyncLog failed', { code: error.code, message: error.message });
}

export async function batchUpsertIdMap(
  rows: Omit<IdMapRow, 'last_synced_at'>[],
): Promise<void> {
  if (!rows.length) return;
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from('contact_id_map')
    .upsert(
      rows.map((r) => ({ ...r, last_synced_at: now })),
      { onConflict: 'instance_id,wix_id,entity_type' },
    );
  if (error) console.error('[supabase] batchUpsertIdMap failed', { code: error.code, message: error.message });
}

// ── Field mapping helpers ─────────────────────────────────────────

const DEFAULT_MAPPINGS: FieldMapping[] = [
  { wixField: 'info.name.first',      zohoProp: 'First_Name',   direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.name.last',       zohoProp: 'Last_Name',    direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.emails[0].email', zohoProp: 'Email',        direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.phones[0].phone', zohoProp: 'Phone',        direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.company.name',    zohoProp: 'Account_Name', direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.jobTitle',        zohoProp: 'Title',        direction: 'bidirectional', transform: 'none' },
];

export async function getFieldMappings(instanceId: string): Promise<FieldMapping[]> {
  const { data } = await getSupabase()
    .from('contact_field_mappings')
    .select('mappings')
    .eq('instance_id', instanceId)
    .single();
  return data?.mappings?.length ? data.mappings : DEFAULT_MAPPINGS;
}

export async function saveFieldMappings(
  instanceId: string,
  mappings: FieldMapping[],
): Promise<void> {
  await getSupabase()
    .from('contact_field_mappings')
    .upsert({ instance_id: instanceId, mappings, updated_at: new Date().toISOString() });
}

// ── Webhook idempotency ───────────────────────────────────────────

export async function markEventProcessed(eventId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('processed_events')
    .insert({ event_id: eventId, processed_at: new Date().toISOString() });

  if (!error) return true;

  if ((error as any).code === '23505') return false;

  console.error('[markEventProcessed] unexpected error — processing event anyway', {
    eventId,
    code: (error as any).code,
    message: error.message,
  });
  return true;
}

// ── siteId helper ─────────────────────────────────────────────────

export async function getSiteId(instanceId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('zoho_tokens')
    .select('site_id')
    .eq('instance_id', instanceId)
    .single();
  return (data as any)?.site_id ?? null;
}

// ── Embed origin allowlist ────────────────────────────────────────

export async function getAllowedOrigins(instanceId: string): Promise<string[]> {
  const { data } = await getSupabase()
    .from('embed_allowed_origins')
    .select('origin')
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((r: { origin: string }) => r.origin);
}

export async function addAllowedOrigin(
  instanceId: string,
  origin: string,
): Promise<void> {
  await getSupabase()
    .from('embed_allowed_origins')
    .upsert({ instance_id: instanceId, origin }, { onConflict: 'instance_id,origin' });
}

export async function removeAllowedOrigin(
  instanceId: string,
  origin: string,
): Promise<void> {
  await getSupabase()
    .from('embed_allowed_origins')
    .delete()
    .eq('instance_id', instanceId)
    .eq('origin', origin);
}
