import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getSupabase } from '../../../backend/_shared/db.ts';
import { customJson } from '../../../utils/customJson.ts';

export const GET: APIRoute = async ({ request }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId)
    return customJson({ error: 'Not authenticated' }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get('jobId');
  if (!jobId)
    return customJson({ error: 'jobId required' }, { status: 400 });

  const supabase = getSupabase();
  const { data: job } = await supabase
    .from('sync_jobs')
    .select('id, status, stats, error, created_at, updated_at')
    .eq('id', jobId)
    .eq('instance_id', instanceId)
    .maybeSingle();

  if (!job)
    return customJson({ error: 'Job not found' }, { status: 404 });

  return customJson(job);
};
