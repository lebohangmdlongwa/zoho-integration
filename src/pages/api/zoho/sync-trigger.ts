import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getSupabase } from '../../../backend/_shared/db.ts';
import { customJson } from '../../../utils/customJson.ts';
import { isWixToZohoAllowed, FREE_CONTACT_LIMIT } from '../../../backend/_shared/plan-limits.ts';
import { createZohoContext, fetchContactsPage } from '../../../backend/zoho-client.ts';

const SYNC_WORKER_URL = 'https://wix-zoho-sync-worker.microapps-2e4.workers.dev';

export const POST: APIRoute = async () => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId)
    return customJson({ error: 'Not authenticated' }, { status: 401 });

  const supabase = getSupabase();

  const wixToZohoAllowed = await isWixToZohoAllowed();

  // For free-plan jobs: count up to 101 Zoho contacts so the upgrade modal can show
  // "Your Zoho account has X contacts — plan supports 100" with a real number.
  // We count Zoho contacts because free plan only syncs Zoho→Wix (Phase 1 is skipped).
  let zohoContactCount: number | undefined;
  if (!wixToZohoAllowed) {
    try {
      const ctx = await createZohoContext(instanceId);
      const { contacts } = await fetchContactsPage(ctx, { page: 1, perPage: 101 });
      zohoContactCount = contacts.length;
    } catch { /* ignore — modal falls back to plan limit */ }
  }

  // Return early if a sync is already in progress
  const { data: active } = await supabase
    .from('sync_jobs')
    .select('id, status')
    .eq('instance_id', instanceId)
    .not('status', 'in', '(done,failed)')
    .maybeSingle();

  if (active) {
    return customJson({ jobId: active.id, status: active.status, alreadyRunning: true });
  }

  const initialStats = !wixToZohoAllowed
    ? { wixToZohoBlocked: true, contactLimit: FREE_CONTACT_LIMIT, ...(zohoContactCount !== undefined ? { zohoContactCount } : {}) }
    : undefined;

  // Create job record — worker picks it up from the queue.
  // Free-plan jobs start with phase1_done: true so the worker skips Wix→Zoho entirely
  // (same pattern as deals jobs which also have no Phase 1).
  const { data: job, error } = await supabase
    .from('sync_jobs')
    .insert({
      instance_id: instanceId,
      status: 'pending',
      phase1_done: !wixToZohoAllowed,
      phase2_done: false,
      ...(initialStats ? { stats: initialStats } : {}),
    })
    .select('id')
    .single();

  if (error || !job) {
    return customJson({ error: error?.message ?? 'Failed to create sync job' }, { status: 500 });
  }

  // Ask the sync worker to enqueue the first tick
  try {
    const res = await fetch(`${SYNC_WORKER_URL}/trigger-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    });
    if (!res.ok) {
      const text = await res.text();
      return customJson({ error: `Sync worker error: ${text}` }, { status: 502 });
    }
  } catch (err) {
    return customJson({ error: `Could not reach sync worker: ${String(err)}` }, { status: 502 });
  }

  return customJson({ jobId: job.id });
};
