import { createClient } from '@supabase/supabase-js';
import { DEALS_PAGE_SIZE, DEALS_FIELDS, buildSupabaseDealRow } from './wix-data';

// Subset of index.ts Env — structurally compatible via TypeScript structural typing.
export interface DealsEnv {
	ZOHO_CLIENT_ID: string;
	ZOHO_CLIENT_SECRET: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	SYNC_QUEUE: Queue<{ jobId: string }>;
}

function getSupabase(env: DealsEnv) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getZohoConfig(env: DealsEnv, instanceId: string): Promise<{ zohoToken: string; apiDomain: string }> {
	const sb = getSupabase(env);
	const { data } = await sb
		.from('zoho_tokens')
		.select('access_token, refresh_token, expires_at, api_domain, dc')
		.eq('instance_id', instanceId)
		.single();

	if (!data) throw new Error(`No ZOHO token for ${instanceId}`);

	let token: string = data.access_token as string;
	const expiresAt = typeof data.expires_at === 'number' ? data.expires_at : Number(data.expires_at);
	if (Date.now() >= expiresAt - 5 * 60 * 1000) {
		const dc = (data.dc as string | null) ?? 'com';
		const params = new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: env.ZOHO_CLIENT_ID,
			client_secret: env.ZOHO_CLIENT_SECRET,
			refresh_token: data.refresh_token as string,
		});
		const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: params.toString(),
		});
		if (!res.ok) throw new Error(`ZOHO token refresh ${res.status}: ${await res.text()}`);
		const tokens = (await res.json()) as { access_token?: string; expires_in?: number };
		if (!tokens.access_token) throw new Error('ZOHO token refresh returned no access_token');
		token = tokens.access_token;
		await sb
			.from('zoho_tokens')
			.update({ access_token: token, expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000 })
			.eq('instance_id', instanceId);
	}

	return {
		zohoToken: token,
		apiDomain: (data.api_domain as string | null) ?? 'https://www.zohoapis.com',
	};
}

// One queue tick: fetch one page of Zoho Deals and upsert into the Supabase 'deals' table.
// Deals jobs are created with phase1_done:true so only phase 2 runs.
export async function processDealsPhase(
	env: DealsEnv,
	supabase: ReturnType<typeof getSupabase>,
	job: Record<string, unknown>,
): Promise<void> {
	const syncRunId = crypto.randomUUID();
	const page = job.phase2_cursor ? parseInt(job.phase2_cursor as string, 10) : 1;
	console.log('[zoho-sync] Deals tick start', { jobId: job.id, page });

	await supabase
		.from('sync_jobs')
		.update({ status: 'running_phase2', updated_at: new Date().toISOString() })
		.eq('id', job.id as string);

	const zohoConfig = await getZohoConfig(env, job.instance_id as string);

	const zohoRes = await fetch(
		`${zohoConfig.apiDomain}/crm/v2/Deals?page=${page}&per_page=${DEALS_PAGE_SIZE}&fields=${DEALS_FIELDS}`,
		{ headers: { Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` } },
	);
	if (!zohoRes.ok) throw new Error(`ZOHO Deals fetch ${zohoRes.status}: ${await zohoRes.text()}`);

	const zohoData = (await zohoRes.json()) as {
		data?: Record<string, unknown>[];
		info?: { more_records?: boolean };
	};
	const deals = zohoData.data ?? [];
	const hasMore = zohoData.info?.more_records ?? false;
	console.log('[zoho-sync] Deals: fetched', { count: deals.length, page, hasMore, jobId: job.id });

	const now = new Date().toISOString();
	let upserted = 0, skipped = 0;
	const syncLogBatch: Record<string, unknown>[] = [];

	if (deals.length > 0) {
		const rows = deals.map((deal) => buildSupabaseDealRow(deal, job.instance_id as string));
		const { error } = await supabase
			.from('deals')
			.upsert(rows, { onConflict: 'instance_id,zoho_deal_id' });

		if (error) {
			console.error('[zoho-sync] Deals: upsert failed', { jobId: job.id, message: error.message });
			skipped = deals.length;
			for (const deal of deals) {
				syncLogBatch.push({
					instance_id: job.instance_id, direction: 'zoho_to_wix', entity_type: 'deal',
					wix_id: null, zoho_id: deal['id'], status: 'error', skip_reason: null,
					error_message: error.message, sync_id: syncRunId,
				});
			}
		} else {
			upserted = deals.length;
			for (const deal of deals) {
				syncLogBatch.push({
					instance_id: job.instance_id, direction: 'zoho_to_wix', entity_type: 'deal',
					wix_id: null, zoho_id: deal['id'], status: 'success', skip_reason: null,
					error_message: null, sync_id: syncRunId,
				});
			}
		}
	}

	if (syncLogBatch.length > 0) await supabase.from('sync_log').insert(syncLogBatch);

	const prevStats = (job.stats as Record<string, unknown>) ?? {};
	const stats = {
		...prevStats,
		jobType: 'deals',
		dealsUpserted: ((prevStats.dealsUpserted as number | undefined) ?? 0) + upserted,
		dealsSkipped: ((prevStats.dealsSkipped as number | undefined) ?? 0) + skipped,
	};

	if (hasMore) {
		console.log('[zoho-sync] Deals: more pages', { jobId: job.id, nextPage: page + 1, stats });
		await supabase
			.from('sync_jobs')
			.update({ phase2_cursor: String(page + 1), status: 'running_phase2', stats, updated_at: now })
			.eq('id', job.id as string);
	} else {
		console.log('[zoho-sync] Deals: all pages done', { jobId: job.id, stats });
		await supabase
			.from('sync_jobs')
			.update({ phase2_done: true, phase2_cursor: null, status: 'done', stats, updated_at: now })
			.eq('id', job.id as string);
	}
}
