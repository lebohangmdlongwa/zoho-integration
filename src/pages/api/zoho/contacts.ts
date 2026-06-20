import type { APIRoute } from 'astro';
import { auth, httpClient } from '@wix/essentials';
import { getSupabase } from '../../../backend/_shared/db.ts';

const WIX_CONTACTS_API = 'https://www.wixapis.com/contacts/v4/contacts/query';

async function fetchWixContactNames(
  wixIds: string[],
): Promise<{
  map: Map<string, { first_name: string; last_name: string; email: string }>;
  apiSucceeded: boolean;
}> {
  const map = new Map<string, { first_name: string; last_name: string; email: string }>();
  if (!wixIds.length) return { map, apiSucceeded: true };

  try {
    const res = await httpClient.fetchWithAuth(WIX_CONTACTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { id: { $in: wixIds } },
        paging: { limit: wixIds.length },
      }),
    });
    if (!res.ok) return { map, apiSucceeded: false };

    const data = (await res.json()) as { contacts?: Record<string, unknown>[] };
    for (const c of data.contacts ?? []) {
      const id = c.id as string;
      const info = (c.info as Record<string, unknown>) ?? {};
      const name = (info.name as Record<string, string>) ?? {};
      const emails = ((info.emails as any)?.items ?? info.emails ?? []) as Array<{ email: string }>;
      map.set(id, {
        first_name: name.first ?? '',
        last_name: name.last ?? '',
        email: emails[0]?.email ?? '',
      });
    }
    return { map, apiSucceeded: true };
  } catch {
    return { map, apiSucceeded: false };
  }
}

export const GET: APIRoute = async ({ url }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId)
    return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const search = url.searchParams.get('search') ?? '';
  const statusFilter = url.searchParams.get('status') ?? 'all';
  const page = parseInt(url.searchParams.get('page') ?? '0', 10);
  const PAGE_SIZE = 20;

  const supabase = getSupabase();

  const { data: idMapRows } = await supabase
    .from('contact_id_map')
    .select('wix_id, zoho_id, last_synced_at, last_sync_source')
    .eq('instance_id', instanceId)
    .eq('entity_type', 'contact')
    .order('last_synced_at', { ascending: false });

  if (!idMapRows?.length) {
    return Response.json({ contacts: [], total: 0 });
  }

  const wixIds = idMapRows.map((r: any) => r.wix_id).filter(Boolean);
  const { data: logRows } = await supabase
    .from('sync_log')
    .select('wix_id, zoho_id, status, direction, error_message, synced_at')
    .eq('instance_id', instanceId)
    .in('wix_id', wixIds)
    .order('synced_at', { ascending: false });

  const latestLog = new Map<string, any>();
  for (const row of (logRows ?? []) as any[]) {
    if (row.wix_id && !latestLog.has(row.wix_id)) {
      latestLog.set(row.wix_id, row);
    }
  }

  let contacts = (idMapRows as any[]).map((m) => {
    const log = latestLog.get(m.wix_id) ?? null;
    return {
      wix_id: m.wix_id,
      zoho_id: m.zoho_id,
      last_synced_at: m.last_synced_at,
      last_sync_source: m.last_sync_source,
      status: log?.status ?? 'success',
      direction: log?.direction === 'form_submit'
        ? 'form_submit'
        : m.last_sync_source === 'wix' ? 'wix_to_zoho'
        : m.last_sync_source === 'zoho' ? 'zoho_to_wix'
        : (log?.direction ?? null),
      error_message: log?.error_message ?? null,
      first_name: '',
      last_name: '',
      email: '',
    };
  });

  if (statusFilter !== 'all') {
    contacts = contacts.filter((c) => c.status === statusFilter);
  }

  const { map: nameMap, apiSucceeded } = await fetchWixContactNames(contacts.map((c) => c.wix_id));

  if (apiSucceeded) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const deletedWixIds = contacts
      .filter((c) => !nameMap.has(c.wix_id) && c.last_synced_at && c.last_synced_at < tenMinutesAgo)
      .map((c) => c.wix_id);
    if (deletedWixIds.length) {
      await Promise.all([
        supabase.from('contact_id_map').delete().eq('instance_id', instanceId).in('wix_id', deletedWixIds),
        supabase.from('sync_log').delete().eq('instance_id', instanceId).in('wix_id', deletedWixIds),
      ]);
      const deletedSet = new Set(deletedWixIds);
      contacts = contacts.filter((c) => !deletedSet.has(c.wix_id));
    }
  }

  contacts = contacts.map((c) => {
    const n = nameMap.get(c.wix_id);
    return n ? { ...c, ...n } : c;
  });

  if (search) {
    const q = search.toLowerCase();
    contacts = contacts.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      return (
        fullName.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.wix_id?.toLowerCase().includes(q) ||
        c.zoho_id?.toLowerCase().includes(q)
      );
    });
  }

  const total = contacts.length;
  const paginated = contacts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return Response.json({ contacts: paginated, total });
};

export const DELETE: APIRoute = async ({ request }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId)
    return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { wix_ids } = (await request.json()) as { wix_ids: string[] };
  if (!Array.isArray(wix_ids) || !wix_ids.length)
    return Response.json({ error: 'wix_ids required' }, { status: 400 });

  const supabase = getSupabase();

  await Promise.all([
    supabase.from('contact_id_map').delete().eq('instance_id', instanceId).in('wix_id', wix_ids),
    supabase.from('sync_log').delete().eq('instance_id', instanceId).in('wix_id', wix_ids),
  ]);

  return Response.json({ deleted: wix_ids.length });
};
