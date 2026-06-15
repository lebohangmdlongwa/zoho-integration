import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getSupabase } from '../../../backend/_shared/db.ts';
import { customJson } from '../../../utils/customJson.ts';

const SYNC_WORKER_URL = 'https://wix-zoho-sync-worker.microapps-2e4.workers.dev';

export const POST: APIRoute = async () => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId)
    return customJson({ error: 'Not authenticated' }, { status: 401 });

  const supabase = getSupabase();

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

  // Create job record — worker picks it up from the queue
  const { data: job, error } = await supabase
    .from('sync_jobs')
    .insert({
      instance_id: instanceId,
      status: 'pending',
      phase1_done: false,
      phase2_done: false,
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
