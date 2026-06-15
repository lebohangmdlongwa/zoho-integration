import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getSyncLog } from '../../../backend/_shared/db.ts';

export const GET: APIRoute = async ({ request }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId)
    return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const rows = await getSyncLog(instanceId, 500);

  const raw = new URL(request.url).searchParams.get('raw');
  if (raw === '1') return Response.json({ entries: rows });

  const errorsOnly = new URL(request.url).searchParams.get('errors');
  if (errorsOnly === '1') {
    const errorMap = new Map<string, { sync_id: string; synced_at: string; count: number; entries: { zoho_id: string | null; wix_id: string | null; direction: string; error_message: string | null; synced_at: string }[] }>();
    for (const row of rows) {
      if (row.status !== 'error') continue;
      const key = row.sync_id ?? row.synced_at;
      if (!errorMap.has(key)) errorMap.set(key, { sync_id: key, synced_at: row.synced_at, count: 0, entries: [] });
      const run = errorMap.get(key)!;
      run.count++;
      run.entries.push({ zoho_id: row.zoho_id ?? null, wix_id: row.wix_id ?? null, direction: row.direction ?? '', error_message: row.error_message ?? null, synced_at: row.synced_at });
    }
    const errorRuns = Array.from(errorMap.values()).sort((a, b) => b.synced_at.localeCompare(a.synced_at));
    return Response.json({ runs: errorRuns });
  }

  const runMap = new Map<
    string,
    {
      sync_id: string;
      synced_at: string;
      contactIds: Set<string>;
      errors: number;
      skipped: number;
      directions: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = row.sync_id ?? row.synced_at;
    if (!runMap.has(key)) {
      runMap.set(key, {
        sync_id: key,
        synced_at: row.synced_at,
        contactIds: new Set(),
        errors: 0,
        skipped: 0,
        directions: new Set(),
      });
    }
    const run = runMap.get(key)!;

    const contactKey = row.zoho_id ?? row.wix_id ?? null;
    if (contactKey) run.contactIds.add(contactKey);

    if (row.status === 'error') run.errors++;
    else if (row.status === 'skipped') run.skipped++;

    if (row.direction) run.directions.add(row.direction);
    if (row.synced_at < run.synced_at) run.synced_at = row.synced_at;
  }

  const runs = Array.from(runMap.values())
    .sort((a, b) => b.synced_at.localeCompare(a.synced_at))
    .map(({ contactIds, directions, errors, skipped, ...rest }) => {
      const total = contactIds.size;
      return {
        ...rest,
        total,
        success: Math.max(0, total - errors - skipped),
        errors,
        skipped,
        directions: Array.from(directions),
      };
    });

  return Response.json({ runs });
};
