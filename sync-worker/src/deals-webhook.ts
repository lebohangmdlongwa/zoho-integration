import { createClient } from '@supabase/supabase-js';
import { DEALS_FIELDS, buildSupabaseDealRow } from './wix-data';

// Subset of WebhookEnv — structurally compatible via TypeScript structural typing.
export interface DealsWebhookEnv {
	ZOHO_CLIENT_ID: string;
	ZOHO_CLIENT_SECRET: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
}

function getSupabase(env: DealsWebhookEnv) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getZohoConfig(env: DealsWebhookEnv, instanceId: string): Promise<{ zohoToken: string; apiDomain: string }> {
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

async function zohoFetchDeal(
	zohoConfig: { zohoToken: string; apiDomain: string },
	zohoId: string,
): Promise<Record<string, unknown> | null> {
	const res = await fetch(`${zohoConfig.apiDomain}/crm/v2/Deals/${zohoId}?fields=${DEALS_FIELDS}`, {
		headers: { Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` },
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`zohoFetchDeal ${res.status}: ${await res.text()}`);
	const data = (await res.json()) as { data?: Record<string, unknown>[] };
	return data.data?.[0] ?? null;
}

// Called from webhook.ts when payload.module === 'Deals'.
// Upserts create/edit events into the Supabase 'deals' table; deletes remove the row.
export async function handleDealsWebhook(
	env: DealsWebhookEnv,
	instanceId: string,
	_siteId: string,
	operation: string,
	ids: string[],
	channelId: string,
	serverTime: number,
): Promise<void> {
	const supabase = getSupabase(env);
	const zohoConfig = await getZohoConfig(env, instanceId);

	for (const zohoId of ids) {
		const eventKey = `${channelId}:deals:${operation}:${zohoId}:${serverTime}`;
		const { error: dupErr } = await supabase
			.from('processed_events')
			.insert({ event_id: eventKey, processed_at: new Date().toISOString() });
		if (dupErr?.code === '23505') {
			console.log('[zoho-sync] webhook deals: duplicate event — skipped', { eventKey });
			continue;
		}

		const syncId = crypto.randomUUID();
		try {
			if (operation === 'delete') {
				await supabase
					.from('deals')
					.delete()
					.eq('instance_id', instanceId)
					.eq('zoho_deal_id', zohoId);
				await supabase.from('sync_log').insert({
					instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'deal',
					wix_id: null, zoho_id: zohoId, status: 'success',
					skip_reason: 'deleted', error_message: null, sync_id: syncId,
				});
				console.log('[zoho-sync] webhook deals: deleted', { zohoId });
				continue;
			}

			const deal = await zohoFetchDeal(zohoConfig, zohoId);
			if (!deal) {
				console.log('[zoho-sync] webhook deals: deal not found in zoho', { zohoId });
				continue;
			}

			const row = buildSupabaseDealRow(deal, instanceId);
			const { error } = await supabase
				.from('deals')
				.upsert(row, { onConflict: 'instance_id,zoho_deal_id' });

			if (error) throw new Error(error.message);

			await supabase.from('sync_log').insert({
				instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'deal',
				wix_id: null, zoho_id: zohoId, status: 'success',
				skip_reason: null, error_message: null, sync_id: syncId,
			});
			console.log('[zoho-sync] webhook deals: upserted', { zohoId, operation });
		} catch (err) {
			console.error('[zoho-webhook] deal processing failed', { zohoId, err: String(err) });
			try {
				await supabase.from('sync_log').insert({
					instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'deal',
					wix_id: null, zoho_id: zohoId, status: 'error',
					skip_reason: null, error_message: String(err), sync_id: null,
				});
			} catch { /* suppress */ }
		}
	}
}
