import { createClient } from '@supabase/supabase-js';
import type { Env } from './index';

async function getZohoAuth(
	env: Env,
	instanceId: string,
): Promise<{ token: string; apiDomain: string } | null> {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data } = await supabase
		.from('zoho_tokens')
		.select('access_token, refresh_token, expires_at, api_domain, dc')
		.eq('instance_id', instanceId)
		.single();

	if (!data) return null;

	let token = data.access_token as string;

	if (Date.now() >= Number(data.expires_at) - 5 * 60 * 1000) {
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
		const refreshed = (await res.json()) as { access_token?: string; expires_in?: number };
		if (!refreshed.access_token) throw new Error('no access_token in refresh response');
		token = refreshed.access_token;
		await supabase
			.from('zoho_tokens')
			.update({ access_token: token, expires_at: Date.now() + (refreshed.expires_in ?? 3600) * 1000 })
			.eq('instance_id', instanceId);
	}

	return { token, apiDomain: (data.api_domain as string | null) ?? 'https://www.zohoapis.com' };
}

// Called from the every-minute cron. Renews any channel expiring within 30 minutes.
// 30-min window is safe regardless of whether ZOHO assigns a 1-hour or 6-day channel.
export async function renewExpiringChannels(env: Env): Promise<void> {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const thirtyMinFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();

	const { data: expiring } = await supabase
		.from('zoho_tokens')
		.select('instance_id, channel_id')
		.not('channel_id', 'is', null)
		.lt('channel_expiry', thirtyMinFromNow);

	if (!expiring?.length) return;

	console.log('[channel-renewal] renewing', expiring.length, 'expiring channel(s)');

	for (const row of expiring) {
		try {
			const auth = await getZohoAuth(env, row.instance_id as string);
			if (!auth) { console.warn('[channel-renewal] no token for', row.instance_id); continue; }

			const requestedExpiry = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
				.toISOString()
				.replace(/\.\d{3}Z$/, '+00:00');

			const res = await fetch(`${auth.apiDomain}/crm/v2/actions/watch`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Authorization: `Zoho-oauthtoken ${auth.token}` },
				body: JSON.stringify({ watch: [{ channel_id: row.channel_id, channel_expiry: requestedExpiry }] }),
			});

			if (!res.ok) {
				console.error('[channel-renewal] API error', { instanceId: row.instance_id, status: res.status, body: await res.text() });
				continue;
			}

			// Store ZOHO's actual assigned expiry (under details.events[0].channel_expiry).
			const data = (await res.json()) as {
				watch?: Array<{ details?: { events?: Array<{ channel_expiry?: string }> } }>;
			};
			const actualExpiry = data?.watch?.[0]?.details?.events?.[0]?.channel_expiry ?? requestedExpiry;

			await supabase.from('zoho_tokens').update({ channel_expiry: actualExpiry }).eq('instance_id', row.instance_id as string);
			console.log('[channel-renewal] renewed', { instanceId: row.instance_id, channelId: row.channel_id, requestedExpiry, actualExpiry });
		} catch (err) {
			console.error('[channel-renewal] error', { instanceId: row.instance_id, err: String(err) });
		}
	}
}
