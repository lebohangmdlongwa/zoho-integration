import { createClient } from '@supabase/supabase-js';
import { handleCallback, handleWebhook } from './webhook';
import { renewExpiringChannels } from './channel-renewal';

export interface Env {
	ZOHO_CLIENT_ID: string;
	ZOHO_CLIENT_SECRET: string;
	ZOHO_CHANNEL_TOKEN: string;
	WIX_CLIENT_ID: string;
	WIX_CLIENT_SECRET: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	// Create first: `npx wrangler queues create zoho-sync-queue`
	SYNC_QUEUE: Queue<{ jobId: string }>;
}

const WIX_CONTACTS_API = 'https://www.wixapis.com/contacts/v4/contacts';
const PHASE1_PAGE_SIZE = 100;
const ZOHO_BATCH_SIZE = 100;

// ── Supabase ──────────────────────────────────────────────────────────────────

function getSupabase(env: Env) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Wix helpers ───────────────────────────────────────────────────────────────

const wixTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getWixAccessToken(env: Env, instanceId: string): Promise<string> {
	const cached = wixTokenCache.get(instanceId);
	if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

	const res = await fetch('https://www.wixapis.com/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'client_credentials',
			client_id: env.WIX_CLIENT_ID,
			client_secret: env.WIX_CLIENT_SECRET,
			instance_id: instanceId,
		}),
	});
	if (!res.ok) throw new Error(`Wix token exchange failed: ${res.status} ${await res.text()}`);
	const data = (await res.json()) as { access_token?: string; expires_in?: number };
	const token = data.access_token ?? '';
	if (!token) throw new Error('Wix token exchange returned no access_token');
	wixTokenCache.set(instanceId, { token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
	return token;
}

async function wixApiHeaders(
	env: Env,
	instanceId: string,
	siteId: string,
): Promise<Record<string, string>> {
	const token = await getWixAccessToken(env, instanceId);
	return {
		Authorization: `Bearer ${token}`,
		'wix-site-id': siteId,
		'Content-Type': 'application/json',
	};
}

async function wixGetContact(
	env: Env,
	instanceId: string,
	siteId: string,
	contactId: string,
): Promise<{ id: string; revision: number; info: Record<string, unknown> } | null> {
	const res = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
		headers: await wixApiHeaders(env, instanceId, siteId),
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`wixGetContact ${res.status}: ${await res.text()}`);
	const { contact } = (await res.json()) as {
		contact: { id: string; revision: number; info: Record<string, unknown> };
	};
	return contact;
}

async function wixUpdateContact(
	env: Env,
	instanceId: string,
	siteId: string,
	contactId: string,
	revision: number,
	info: Record<string, unknown>,
): Promise<void> {
	const headers = await wixApiHeaders(env, instanceId, siteId);
	const res = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify({ revision, info }),
	});
	if (res.status === 409) {
		const errText = await res.text();
		let errBody: { details?: { applicationError?: { data?: { duplicatePhone?: boolean } } } } = {};
		try { errBody = JSON.parse(errText); } catch { /* ignore */ }
		if (errBody?.details?.applicationError?.data?.duplicatePhone) {
			const { phones: _p, ...infoNoPhone } = info as Record<string, unknown> & { phones?: unknown };
			const retry = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
				method: 'PATCH',
				headers,
				body: JSON.stringify({ revision, info: infoNoPhone }),
			});
			if (!retry.ok) throw new Error(`wixUpdateContact retry ${retry.status}: ${await retry.text()}`);
			return;
		}
		// INVALID_REVISION — re-fetch live revision and retry
		const fresh = await wixGetContact(env, instanceId, siteId, contactId);
		if (!fresh) throw new Error(`wixUpdateContact 409: contact ${contactId} not found on re-fetch`);
		const retry2 = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ revision: fresh.revision, info }),
		});
		if (!retry2.ok) throw new Error(`wixUpdateContact retry2 ${retry2.status}: ${await retry2.text()}`);
		return;
	}
	if (!res.ok) throw new Error(`wixUpdateContact ${res.status}: ${await res.text()}`);
}

async function wixCreateContact(
	env: Env,
	instanceId: string,
	siteId: string,
	info: Record<string, unknown>,
): Promise<string | null> {
	console.log('[zoho-sync] wixCreateContact payload', JSON.stringify({ info }));
	const headers = await wixApiHeaders(env, instanceId, siteId);
	const res = await fetch(WIX_CONTACTS_API, {
		method: 'POST',
		headers,
		body: JSON.stringify({ info }),
	});
	if (res.status === 409) {
		const body = (await res.json()) as {
			details?: { applicationError?: { data?: { duplicateContactId?: string } } };
		};
		const existingId = body?.details?.applicationError?.data?.duplicateContactId;
		if (!existingId) throw new Error('409 but no duplicateContactId');
		const existing = await wixGetContact(env, instanceId, siteId, existingId);
		if (!existing) throw new Error(`wixCreateContact 409: existing contact ${existingId} not found`);

		// If the 409 was caused by a shared phone (different person), strip the phone
		// and create a fresh contact instead of overwriting an unrelated contact.
		const newEmail = (info.emails as { items?: { email: string }[] } | undefined)?.items?.[0]?.email ?? null;
		const existingEmails = new Set(
			(existing.info.emails as { items?: { email: string }[] } | undefined)?.items?.map((e) => e.email) ?? [],
		);
		// Only treat as the same person if we have a confirmed email match.
		// Without an email match (no email on new contact, or different email), strip
		// the phone and create a fresh contact — prevents unrelated contacts from
		// collapsing because they share a common phone like 555-555-5555.
		if (!newEmail || !existingEmails.has(newEmail)) {
			const { phones: _p, ...infoNoPhone } = info as Record<string, unknown> & { phones?: unknown };
			const retryRes = await fetch(WIX_CONTACTS_API, {
				method: 'POST',
				headers,
				body: JSON.stringify({ info: infoNoPhone }),
			});
			if (retryRes.status === 409) {
				// Email conflict on retry — update that contact (same person, different phone)
				const retryBody = (await retryRes.json()) as {
					details?: { applicationError?: { data?: { duplicateContactId?: string } } };
				};
				const retryExistingId = retryBody?.details?.applicationError?.data?.duplicateContactId;
				if (!retryExistingId) throw new Error('wixCreateContact phoneRetry 409 but no duplicateContactId');
				const retryExisting = await wixGetContact(env, instanceId, siteId, retryExistingId);
				if (!retryExisting) throw new Error(`wixCreateContact phoneRetry: contact ${retryExistingId} not found`);
				await wixUpdateContact(env, instanceId, siteId, retryExistingId, retryExisting.revision, infoNoPhone);
				return retryExistingId;
			}
			if (!retryRes.ok) throw new Error(`wixCreateContact phoneRetry ${retryRes.status}: ${await retryRes.text()}`);
			const retryData = (await retryRes.json()) as { contact?: { id?: string } };
			return retryData.contact?.id ?? null;
		}

		// Confirmed same person (email match) — update the existing contact.
		await wixUpdateContact(env, instanceId, siteId, existingId, existing.revision, info);
		return existingId;
	}
	if (!res.ok) throw new Error(`wixCreateContact ${res.status}: ${await res.text()}`);
	const data = (await res.json()) as { contact?: { id?: string } };
	return data.contact?.id ?? null;
}

// ── ZOHO helpers ──────────────────────────────────────────────────────────────

interface ZohoConfig {
	zohoToken: string;
	apiDomain: string;
	siteId: string;
}

async function getZohoConfig(env: Env, instanceId: string): Promise<ZohoConfig> {
	const sb = getSupabase(env);
	const { data } = await sb
		.from('zoho_tokens')
		.select('access_token, refresh_token, expires_at, api_domain, dc, site_id')
		.eq('instance_id', instanceId)
		.single();

	if (!data) throw new Error(`No ZOHO token for ${instanceId}`);

	let token: string = data.access_token;
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
		if (!tokens.access_token) throw new Error(`ZOHO token refresh returned no access_token`);
		token = tokens.access_token;
		await sb
			.from('zoho_tokens')
			.update({
				access_token: token,
				expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
			})
			.eq('instance_id', instanceId);
		console.log('[zoho-sync] token: zoho access token refreshed', { instanceId, dc });
	}

	const apiDomain = (data.api_domain as string | null) ?? 'https://www.zohoapis.com';
	const siteId = (data.site_id as string | null) ?? instanceId;
	console.log('[zoho-sync] token: zoho config loaded', { instanceId, apiDomain, siteId });
	return { zohoToken: token, apiDomain, siteId };
}

// ── Field mapping helpers ─────────────────────────────────────────────────────

type FieldMapping = {
	wixField: string;
	zohoProp: string;
	direction: string;
	transform?: string;
};

function applyTransform(value: string, transform?: string): string {
	if (transform === 'lowercase') return value.toLowerCase();
	if (transform === 'trim') return value.trim();
	if (transform === 'uppercase') return value.toUpperCase();
	return value;
}

async function getFieldMappings(env: Env, instanceId: string): Promise<FieldMapping[]> {
	const { data } = await getSupabase(env)
		.from('contact_field_mappings')
		.select('mappings')
		.eq('instance_id', instanceId)
		.single();
	const saved: FieldMapping[] = (data?.mappings as FieldMapping[]) ?? [];
	const defaults: FieldMapping[] = [
		{ wixField: 'info.name.first', zohoProp: 'First_Name', direction: 'bidirectional' },
		{ wixField: 'info.name.last', zohoProp: 'Last_Name', direction: 'bidirectional' },
		{ wixField: 'info.emails[0].email', zohoProp: 'Email', direction: 'bidirectional' },
		{ wixField: 'info.phones[0].phone', zohoProp: 'Phone', direction: 'bidirectional' },
		{ wixField: 'info.company', zohoProp: 'Account_Name', direction: 'bidirectional' },
		{ wixField: 'info.jobTitle', zohoProp: 'Title', direction: 'bidirectional' },
	];
	return saved.length ? saved : defaults;
}

function getWixFieldValue(contact: Record<string, unknown>, wixField: string): string | null {
	const path = wixField
		.replace('info.', '')
		.replace(/\[(\d+)\]/g, '.$1')
		.split('.');
	let val: unknown = (contact.info as Record<string, unknown>) ?? contact;
	for (const key of path) {
		if (val == null) return null;
		if ((val as any)?.items != null && /^\d+$/.test(key)) {
			val = (val as any).items[parseInt(key, 10)];
		} else {
			val = (val as any)[key];
		}
	}
	if (val == null || typeof val === 'object') return null;
	return String(val).trim() || null;
}

function buildZohoProps(
	contact: Record<string, unknown>,
	mappings: FieldMapping[],
): Record<string, string> {
	const props: Record<string, string> = {};
	const applicable = mappings.filter(
		(m) => m.direction === 'wix_to_zoho' || m.direction === 'bidirectional',
	);
	for (const m of applicable) {
		const value = getWixFieldValue(contact, m.wixField);
		if (value) props[m.zohoProp] = applyTransform(value, m.transform);
	}
	// ZOHO requires Last_Name — fall back to first name or email local part
	if (!props['Last_Name']) {
		if (props['First_Name']) {
			props['Last_Name'] = props['First_Name'];
			delete props['First_Name'];
		} else if (props['Email']) {
			props['Last_Name'] = props['Email'].split('@')[0];
		}
	}
	console.log('[zoho-sync] buildZohoProps', {
		wixId: contact.id ?? null,
		mappedKeys: Object.keys(props),
		hasEmail: !!props['Email'],
		hasLastName: !!props['Last_Name'],
	});
	return props;
}

function buildWixInfo(
	zohoContact: Record<string, unknown>,
	mappings: FieldMapping[],
): Record<string, unknown> {
	const info: Record<string, unknown> = {};
	const applicable = mappings.filter(
		(m) => m.direction === 'zoho_to_wix' || m.direction === 'bidirectional',
	);

	for (const m of applicable) {
		const raw = zohoContact[m.zohoProp];
		if (!raw) continue;
		// ZOHO related-record fields (e.g. Account_Name) come back as { name, id } objects
		const rawStr: string = typeof raw === 'object' && raw !== null && 'name' in (raw as object)
			? (raw as { name: string }).name
			: String(raw);
		if (!rawStr) continue;
		const value = applyTransform(rawStr, m.transform);
		const parts = m.wixField
			.replace('info.', '')
			.replace(/\[(\d+)\]/g, '.$1')
			.split('.');

		if (parts[0] === 'name') {
			(info.name as Record<string, string> | undefined) ??
				((info.name as Record<string, unknown>) = {});
			((info.name as Record<string, unknown>))[parts[1]] = value;
		} else if (parts[0] === 'emails') {
			// Skip emails with reserved/invalid TLDs that Wix rejects
			if (value.endsWith('.invalid') || value.endsWith('.test') || value.endsWith('.example')) continue;
			info.emails = { items: [{ email: value, tag: 'MAIN' }] };
		} else if (parts[0] === 'phones') {
			info.phones = { items: [{ phone: value, tag: 'MAIN' }] };
		} else if (parts[0] === 'company') {
			info.company = value;
		} else if (parts[0] === 'jobTitle') {
			info.jobTitle = value;
		}
	}

	console.log('[zoho-sync] buildWixInfo', {
		zohoId: zohoContact['id'] ?? null,
		mappedKeys: Object.keys(info),
		hasEmail: !!(info.emails),
		hasName: !!(info.name),
	});
	return info;
}

async function searchWixByEmail(
	wixToken: string,
	siteId: string,
	email: string,
): Promise<Record<string, unknown> | null> {
	const res = await fetch('https://www.wixapis.com/contacts/v4/contacts/query', {
		method: 'POST',
		headers: { Authorization: `Bearer ${wixToken}`, 'wix-site-id': siteId, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			filter: { 'info.emails.items.email': { $hasSome: [email] } },
			paging: { limit: 1 },
		}),
	});
	if (!res.ok) { console.warn('[zoho-sync] searchWixByEmail failed', { status: res.status }); return null; }
	const data = (await res.json()) as { contacts?: Record<string, unknown>[] };
	return data.contacts?.[0] ?? null;
}


// ── Sync phases ───────────────────────────────────────────────────────────────

async function processPhase1Tick(env: Env, supabase: ReturnType<typeof getSupabase>, job: Record<string, unknown>): Promise<void> {
	const syncRunId = crypto.randomUUID();
	console.log('[zoho-sync] Phase1 tick start', { jobId: job.id, cursor: job.phase1_cursor ?? 'start' });
	await supabase
		.from('sync_jobs')
		.update({ status: 'running_phase1', updated_at: new Date().toISOString() })
		.eq('id', job.id as string);

	const [wixToken, zohoConfig, mappings] = await Promise.all([
		getWixAccessToken(env, job.instance_id as string),
		getZohoConfig(env, job.instance_id as string),
		getFieldMappings(env, job.instance_id as string),
	]);

	const wixToZohoMaps = mappings.filter(
		(m) => m.direction === 'wix_to_zoho' || m.direction === 'bidirectional',
	);

	if (wixToZohoMaps.length === 0) {
		console.log('[zoho-sync] Phase1: no wix_to_zoho mappings — skipping to Phase 2', { jobId: job.id });
		await supabase
			.from('sync_jobs')
			.update({ phase1_done: true, phase1_cursor: null, status: 'running_phase2', updated_at: new Date().toISOString() })
			.eq('id', job.id as string);
		return;
	}

	// Fetch one page of Wix contacts
	const res = await fetch('https://www.wixapis.com/contacts/v4/contacts/query', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${wixToken}`,
			'wix-site-id': zohoConfig.siteId,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			cursorPaging: {
				limit: PHASE1_PAGE_SIZE,
				...(job.phase1_cursor ? { cursor: job.phase1_cursor as string } : {}),
			},
		}),
	});
	if (!res.ok) throw new Error(`Wix contacts query ${res.status}: ${await res.text()}`);

	const { contacts, metadata } = (await res.json()) as {
		contacts: Record<string, unknown>[];
		metadata?: { cursors?: { next?: string } };
	};
	console.log('[zoho-sync] Phase1: wix contacts fetched', {
		count: contacts.length,
		hasMore: !!metadata?.cursors?.next,
		cursor: job.phase1_cursor ?? 'first',
		jobId: job.id,
	});

	// Load existing id map for this page so already-linked contacts skip the upsert
	const wixIds = contacts.map((c) => c.id as string).filter(Boolean);
	const { data: idMapRows } = await supabase
		.from('contact_id_map')
		.select('wix_id, zoho_id')
		.eq('instance_id', job.instance_id as string)
		.in('wix_id', wixIds);
	const zohoIdByWixId = new Map<string, string>(
		(idMapRows ?? []).map((r: any) => [r.wix_id as string, r.zoho_id as string]),
	);

	const syncSourceStamp = `wix_sync_${Date.now()}`;
	const syncLogBatch: Record<string, unknown>[] = [];
	const idMapBatch: Record<string, unknown>[] = [];
	const now = new Date().toISOString();

	type DirectItem = { props: Record<string, string>; wixId: string; zohoId: string };
	type UpsertItem = { props: Record<string, string>; wixId: string };

	const directItems: DirectItem[] = [];
	const upsertItems: UpsertItem[] = [];

	for (const contact of contacts) {
		const props = buildZohoProps(contact, wixToZohoMaps);
		const wixId = contact.id as string;
		props['Wix_Contact_Id'] = wixId;
		props['Wix_Sync_Source'] = syncSourceStamp;

		const existingZohoId = zohoIdByWixId.get(wixId);
		if (existingZohoId) {
			directItems.push({ props, wixId, zohoId: existingZohoId });
		} else if (props['Email']) {
			upsertItems.push({ props, wixId });
		} else {
			console.log('[zoho-sync] Phase1: skipped (no_email)', { wixId });
			syncLogBatch.push({
				instance_id: job.instance_id, direction: 'wix_to_zoho', entity_type: 'contact',
				wix_id: wixId, zoho_id: null, status: 'skipped', skip_reason: 'no_email',
				error_message: null, sync_id: syncRunId,
			});
		}
	}

	console.log('[zoho-sync] Phase1: batches ready', {
		direct: directItems.length, upsert: upsertItems.length, jobId: job.id,
	});

	// Direct update batch — contacts already linked to a ZOHO record (bulk PUT)
	for (let i = 0; i < directItems.length; i += ZOHO_BATCH_SIZE) {
		const batch = directItems.slice(i, i + ZOHO_BATCH_SIZE);
		const putData = batch.map(({ props, zohoId }) => ({ ...props, id: zohoId }));
		console.log('[zoho-sync] Phase1: PUT direct update batch', { batchSize: batch.length, batchStart: i });

		const putRes = await fetch(`${zohoConfig.apiDomain}/crm/v2/Contacts`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` },
			body: JSON.stringify({ data: putData }),
		});

		let putResults: { code: string; details: { id: string }; message: string }[] = [];
		if (putRes.ok) {
			const d = (await putRes.json()) as { data: { code: string; details: { id: string }; message: string }[] };
			putResults = d.data ?? [];
			console.log('[zoho-sync] Phase1: ZOHO PUT response', {
				status: putRes.status,
				results: putResults.map((r) => ({ code: r.code, id: r.details?.id })),
			});
		} else {
			console.error('[zoho-sync] Phase1: ZOHO PUT error', { status: putRes.status, body: await putRes.text() });
		}

		for (let j = 0; j < batch.length; j++) {
			const { wixId, zohoId } = batch[j];
			const result = putResults[j];
			const isSuccess = result?.code === 'SUCCESS';
			if (isSuccess) {
				idMapBatch.push({
					instance_id: job.instance_id, wix_id: wixId, zoho_id: zohoId,
					entity_type: 'contact', last_sync_source: 'wix',
					last_sync_id: syncRunId, last_synced_at: now,
				});
			}
			console.log(`[zoho-sync] Phase1: direct ${isSuccess ? 'updated' : 'failed'}`, {
				wixId, zohoId, code: result?.code ?? null,
			});
			syncLogBatch.push({
				instance_id: job.instance_id, direction: 'wix_to_zoho', entity_type: 'contact',
				wix_id: wixId, zoho_id: isSuccess ? zohoId : null,
				status: isSuccess ? 'success' : 'error', skip_reason: null,
				error_message: isSuccess ? null : (result?.message ?? 'PUT failed'),
				sync_id: syncRunId,
			});
		}
	}

	// Upsert batch — new contacts and email-matched contacts
	// duplicate_check_fields: ["Wix_Contact_Id", "Email"] covers:
	//   1. Previously synced contacts (matched by Wix_Contact_Id)
	//   2. Pre-existing ZOHO contacts (matched by Email)
	//   3. Brand new contacts (created fresh)
	for (let i = 0; i < upsertItems.length; i += ZOHO_BATCH_SIZE) {
		const batch = upsertItems.slice(i, i + ZOHO_BATCH_SIZE);
		const batchWixIds = batch.map(({ wixId }) => wixId);
		console.log('[zoho-sync] Phase1: upserting batch to ZOHO', { batchSize: batch.length, batchStart: i });

		const zohoRes = await fetch(`${zohoConfig.apiDomain}/crm/v2/Contacts/upsert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` },
			body: JSON.stringify({
				data: batch.map(({ props }) => props),
				duplicate_check_fields: ['Wix_Contact_Id', 'Email'],
			}),
		});

		let upsertResults: { code: string; details: { id: string }; message: string }[] = [];
		if (zohoRes.ok) {
			const d = (await zohoRes.json()) as { data: { code: string; details: { id: string }; message: string }[] };
			upsertResults = d.data ?? [];
			console.log('[zoho-sync] Phase1: ZOHO upsert response', {
				status: zohoRes.status,
				results: upsertResults.map((r) => ({ code: r.code, id: r.details?.id, message: r.message })),
			});
		} else {
			console.error('[zoho-sync] Phase1: ZOHO upsert HTTP error', { status: zohoRes.status, body: await zohoRes.text() });
		}

		for (let j = 0; j < batchWixIds.length; j++) {
			const wixId = batchWixIds[j];
			const result = upsertResults[j];
			const zohoId = result?.details?.id ?? null;
			const isSuccess = result?.code === 'SUCCESS' || result?.code === 'DUPLICATE_DATA';
			if (zohoId) {
				idMapBatch.push({
					instance_id: job.instance_id, wix_id: wixId, zoho_id: zohoId,
					entity_type: 'contact', last_sync_source: 'wix',
					last_sync_id: syncRunId, last_synced_at: now,
				});
			}
			console.log(`[zoho-sync] Phase1: contact ${isSuccess ? 'synced' : 'failed'}`, {
				wixId, zohoId, code: result?.code ?? null, message: result?.message ?? null,
			});
			syncLogBatch.push({
				instance_id: job.instance_id, direction: 'wix_to_zoho', entity_type: 'contact',
				wix_id: wixId, zoho_id: zohoId,
				status: isSuccess ? 'success' : 'error', skip_reason: null,
				error_message: isSuccess ? null : (result?.message ?? 'Upsert failed'),
				sync_id: syncRunId,
			});
		}
	}

	if (idMapBatch.length > 0) {
		const { error: idMapErr } = await supabase
			.from('contact_id_map')
			.upsert(idMapBatch, { onConflict: 'instance_id,wix_id,entity_type' });
		if (idMapErr) {
			console.error('[zoho-sync] Phase1: contact_id_map upsert failed', {
				jobId: job.id, code: idMapErr.code, message: idMapErr.message,
			});
		}
	}
	if (syncLogBatch.length > 0) await supabase.from('sync_log').insert(syncLogBatch);

	const nextCursor = metadata?.cursors?.next ?? null;
	const stats = {
		...((job.stats as Record<string, unknown>) ?? {}),
		phase1Processed: (((job.stats as any)?.phase1Processed ?? 0) as number) + contacts.length,
	};

	if (nextCursor) {
		console.log('[zoho-sync] Phase1: more pages', { jobId: job.id, nextCursor });
		await supabase
			.from('sync_jobs')
			.update({ phase1_cursor: nextCursor, stats, updated_at: new Date().toISOString() })
			.eq('id', job.id as string);
	} else {
		console.log('[zoho-sync] Phase1: all pages done — moving to Phase 2', { jobId: job.id, stats });
		await supabase
			.from('sync_jobs')
			.update({ phase1_done: true, phase1_cursor: null, status: 'running_phase2', stats, updated_at: new Date().toISOString() })
			.eq('id', job.id as string);
	}
}

async function processPhase2Tick(env: Env, supabase: ReturnType<typeof getSupabase>, job: Record<string, unknown>): Promise<void> {
	const PHASE2_PAGE_SIZE = 15; // contacts per tick — keeps invocation under Cloudflare's 50-subrequest limit
	const syncRunId = crypto.randomUUID();
	const page = job.phase2_cursor ? parseInt(job.phase2_cursor as string, 10) : 1;
	console.log('[zoho-sync] Phase2 tick start', { jobId: job.id, page });
	await supabase
		.from('sync_jobs')
		.update({ status: 'running_phase2', updated_at: new Date().toISOString() })
		.eq('id', job.id as string);

	const [wixToken, zohoConfig, mappings] = await Promise.all([
		getWixAccessToken(env, job.instance_id as string),
		getZohoConfig(env, job.instance_id as string),
		getFieldMappings(env, job.instance_id as string),
	]);

	const zohoToWixMaps = mappings.filter(
		(m) => m.direction === 'zoho_to_wix' || m.direction === 'bidirectional',
	);

	if (zohoToWixMaps.length === 0) {
		console.log('[zoho-sync] Phase2: no zoho_to_wix mappings — marking done', { jobId: job.id });
		await supabase
			.from('sync_jobs')
			.update({ phase2_done: true, phase2_cursor: null, status: 'done', updated_at: new Date().toISOString() })
			.eq('id', job.id as string);
		return;
	}

	// Fetch one page of ZOHO contacts
	const zohoRes = await fetch(
		`${zohoConfig.apiDomain}/crm/v2/Contacts?page=${page}&per_page=${PHASE2_PAGE_SIZE}`,
		{ headers: { Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` } },
	);
	if (!zohoRes.ok) throw new Error(`ZOHO contacts fetch ${zohoRes.status}: ${await zohoRes.text()}`);

	const zohoData = (await zohoRes.json()) as {
		data?: Record<string, string | undefined>[];
		info?: { more_records?: boolean };
	};
	const zohoContacts = zohoData.data ?? [];
	const hasMore = zohoData.info?.more_records ?? false;
	console.log('[zoho-sync] Phase2: zoho contacts fetched', { count: zohoContacts.length, page, hasMore, jobId: job.id });

	const zohoIds = zohoContacts.map((c) => c['id'] as string).filter(Boolean);
	// Wix_Contact_Id is stamped by Phase 1 on each ZOHO contact — used as fallback link
	const stampedWixIds = zohoContacts
		.map((c) => (c['Wix_Contact_Id'] as string | undefined)?.trim())
		.filter((id): id is string => !!id);

	// Single idMap query: match by ZOHO id OR by the Wix_Contact_Id stamp (like HubSpot)
	let idMapQuery = supabase
		.from('contact_id_map')
		.select('wix_id, zoho_id')
		.eq('instance_id', job.instance_id as string);

	if (stampedWixIds.length > 0) {
		idMapQuery = (idMapQuery as any).or(
			`zoho_id.in.(${zohoIds.join(',')}),wix_id.in.(${stampedWixIds.join(',')})`,
		);
	} else {
		idMapQuery = idMapQuery.in('zoho_id', zohoIds);
	}

	const { data: idMapRows } = await idMapQuery;

	// idMap keyed by ZOHO ID — for the primary lookup path
	const wixIdByZohoId = new Map<string, string>(
		(idMapRows ?? [])
			.filter((r: any) => zohoIds.includes(r.zoho_id))
			.map((r: any) => [r.zoho_id as string, r.wix_id as string]),
	);
	// Reverse map: wix_id → zoho_id — guards against two ZOHO contacts claiming the same Wix ID
	const zohoIdByWixId = new Map<string, string>(
		(idMapRows ?? []).map((r: any) => [r.wix_id as string, r.zoho_id as string]),
	);

	// Bulk-prefetch Wix revisions: 1 query replaces N individual GETs
	const prefetchWixIds: string[] = [];
	for (const c of zohoContacts) {
		const wixId =
			wixIdByZohoId.get(c['id'] as string) ??
			(c['Wix_Contact_Id'] as string | undefined)?.trim();
		if (wixId) prefetchWixIds.push(wixId);
	}

	const wixRevisionMap = new Map<string, number>();
	if (prefetchWixIds.length > 0) {
		const qRes = await fetch('https://www.wixapis.com/contacts/v4/contacts/query', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${wixToken}`,
				'wix-site-id': zohoConfig.siteId,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				filter: { id: { $in: prefetchWixIds } },
				paging: { limit: prefetchWixIds.length },
			}),
		});
		if (!qRes.ok) throw new Error(`Wix bulk revision prefetch ${qRes.status}: ${await qRes.text()}`);
		const { contacts: found } = (await qRes.json()) as {
			contacts?: { id: string; revision?: number }[];
		};
		for (const fc of found ?? []) wixRevisionMap.set(fc.id, fc.revision ?? 1);
	}

	// Pre-stamp known wix contacts with last_sync_source='zoho' BEFORE PATCHing.
	// The Wix contact.updated event fires milliseconds after each PATCH — the bounce
	// guard in the Wix event handler checks last_sync_source; pre-stamping ensures it
	// sees 'zoho' before the echo arrives.
	const preStampWixIds = [...wixIdByZohoId.values()];
	if (preStampWixIds.length > 0) {
		await supabase
			.from('contact_id_map')
			.update({ last_sync_source: 'zoho', last_synced_at: new Date().toISOString() })
			.eq('instance_id', job.instance_id as string)
			.in('wix_id', preStampWixIds);
	}

	let created = 0, updated = 0, skipped = 0;
	const idMapBatch: Record<string, unknown>[] = [];
	const syncLogBatch: Record<string, unknown>[] = [];
	const now = new Date().toISOString();
	// Tracks newly created Wix contacts so we can back-stamp Wix_Contact_Id on the ZOHO side
	const newContactStamps: { zohoId: string; wixId: string }[] = [];
	const linkedWixIdSet = new Set<string>(wixIdByZohoId.values());

	for (const zohoContact of zohoContacts) {
		const zohoId = zohoContact['id'] as string;

		try {
			const existingWixIdCheck = wixIdByZohoId.get(zohoId) ?? null;
			const knownWixIdCheck = (zohoContact['Wix_Contact_Id'] as string | undefined)?.trim() ?? null;
			console.log('[zoho-sync] Phase2: processing contact', {
				zohoId,
				zohoName: `${zohoContact['First_Name'] ?? ''} ${zohoContact['Last_Name'] ?? ''}`.trim() || null,
				existingWixId: existingWixIdCheck,
				knownWixId: knownWixIdCheck,
				jobId: job.id,
			});

			const wixInfo = buildWixInfo(zohoContact, zohoToWixMaps);
			if (!Object.keys(wixInfo).length) {
				skipped++;
				console.log('[zoho-sync] Phase2: skipped contact', {
					zohoId, reason: 'no_mapped_values', jobId: job.id,
				});
				syncLogBatch.push({
					instance_id: job.instance_id, direction: 'zoho_to_wix', entity_type: 'contact',
					wix_id: wixIdByZohoId.get(zohoId) ?? null, zoho_id: zohoId,
					status: 'skipped', skip_reason: 'no_mapped_values', error_message: null, sync_id: syncRunId,
				});
				continue;
			}

			// Skip contacts with no usable email — check wixInfo (post-filter) so reserved-TLD
			// addresses that buildWixInfo discards also count as "no email"
			const wixEmail = ((wixInfo as any).emails?.items?.[0]?.email as string | undefined) ?? null;
			if (!wixEmail) {
				skipped++;
				syncLogBatch.push({
					instance_id: job.instance_id, direction: 'zoho_to_wix', entity_type: 'contact',
					wix_id: wixIdByZohoId.get(zohoId) ?? null, zoho_id: zohoId,
					status: 'skipped', skip_reason: 'no_email', error_message: null, sync_id: syncRunId,
				});
				continue;
			}

			const existingWixId = wixIdByZohoId.get(zohoId) ?? null;
			const knownWixId = (zohoContact['Wix_Contact_Id'] as string | undefined)?.trim() ?? null;
			let resolvedWixId: string | null = null;

			if (existingWixId) {
				const revision = wixRevisionMap.get(existingWixId);
				if (revision == null) {
					console.log('[zoho-sync] Phase2: stale idMap — recreating wix contact', { zohoId, existingWixId });
					const newId = await wixCreateContact(env, job.instance_id as string, zohoConfig.siteId, wixInfo);
					resolvedWixId = newId;
					if (newId) { created++; newContactStamps.push({ zohoId, wixId: newId }); linkedWixIdSet.add(newId); }
					console.log('[zoho-sync] Phase2: wix contact created', { zohoId, newWixId: newId });
				} else {
					console.log('[zoho-sync] Phase2: updating wix contact', { zohoId, wixId: existingWixId, revision });
					await wixUpdateContact(env, job.instance_id as string, zohoConfig.siteId, existingWixId, revision, wixInfo);
					resolvedWixId = existingWixId;
					updated++;
					console.log('[zoho-sync] Phase2: wix contact updated', { zohoId, wixId: existingWixId });
				}
			} else if (knownWixId) {
				const claimedByZohoId = zohoIdByWixId.get(knownWixId);
				if (claimedByZohoId && claimedByZohoId !== zohoId) {
					// Stale Wix_Contact_Id stamp — owned by a different Zoho contact (e.g. from
					// a previous bad run where duplicate phones collapsed contacts). Create a fresh
					// Wix contact; newContactStamps will overwrite the stale stamp on Zoho after
					// the loop so future ticks find the correct link.
					console.log('[zoho-sync] Phase2: stale stamp — creating fresh', {
						zohoId, knownWixId, claimedByZohoId,
					});
					const newId = await wixCreateContact(env, job.instance_id as string, zohoConfig.siteId, wixInfo);
					resolvedWixId = newId;
					if (newId) { created++; newContactStamps.push({ zohoId, wixId: newId }); linkedWixIdSet.add(newId); }
				} else if (wixRevisionMap.has(knownWixId)) {
					await wixUpdateContact(
						env, job.instance_id as string, zohoConfig.siteId,
						knownWixId, wixRevisionMap.get(knownWixId)!, wixInfo,
					);
					resolvedWixId = knownWixId;
					updated++;
				} else {
					// knownWixId not in Wix — no-email contacts are already skipped above,
					// so create fresh (email 409 dedup handles collisions)
					const newId = await wixCreateContact(env, job.instance_id as string, zohoConfig.siteId, wixInfo);
					resolvedWixId = newId;
					if (newId) { created++; newContactStamps.push({ zohoId, wixId: newId }); linkedWixIdSet.add(newId); }
					console.log('[zoho-sync] Phase2: stale knownWixId — created new', { zohoId, newWixId: newId });
				}
			} else {
				// No id map link and no Wix_Contact_Id stamp — no-email contacts are
				// skipped above, so every contact here has a usable email
				const found = await searchWixByEmail(wixToken, zohoConfig.siteId, wixEmail);
				if (found) {
					const foundWixId = found.id as string;
					const { data: existingLink } = await supabase
						.from('contact_id_map')
						.select('zoho_id')
						.eq('instance_id', job.instance_id as string)
						.eq('wix_id', foundWixId)
						.maybeSingle();
					if (!existingLink) {
						const foundRevision = (found as any).revision ?? 1;
						if (Object.keys(wixInfo).length > 0) {
							await wixUpdateContact(env, job.instance_id as string, zohoConfig.siteId, foundWixId, foundRevision, wixInfo);
						}
						resolvedWixId = foundWixId;
						updated++;
						newContactStamps.push({ zohoId, wixId: foundWixId });
						linkedWixIdSet.add(foundWixId);
						console.log('[zoho-sync] Phase2: linked by email match', { zohoId, wixId: foundWixId });
					} else {
						// Wix contact already linked to a different ZOHO contact — create new
						const newId = await wixCreateContact(env, job.instance_id as string, zohoConfig.siteId, wixInfo);
						resolvedWixId = newId;
						if (newId) { created++; newContactStamps.push({ zohoId, wixId: newId }); linkedWixIdSet.add(newId); }
						console.log('[zoho-sync] Phase2: email match already linked — created new', { zohoId, newWixId: newId });
					}
				} else {
					const newId = await wixCreateContact(env, job.instance_id as string, zohoConfig.siteId, wixInfo);
					resolvedWixId = newId;
					if (newId) { created++; newContactStamps.push({ zohoId, wixId: newId }); linkedWixIdSet.add(newId); }
					console.log('[zoho-sync] Phase2: no email match — created new', { zohoId, newWixId: newId });
				}
			}

			if (resolvedWixId) {
				idMapBatch.push({
					instance_id: job.instance_id, wix_id: resolvedWixId, zoho_id: zohoId,
					entity_type: 'contact', last_sync_source: 'zoho',
					last_sync_id: syncRunId, last_synced_at: now,
				});
			}
			syncLogBatch.push({
				instance_id: job.instance_id, direction: 'zoho_to_wix', entity_type: 'contact',
				wix_id: resolvedWixId, zoho_id: zohoId, status: 'success',
				skip_reason: null, error_message: null, sync_id: syncRunId,
			});
		} catch (err) {
			console.error('[zoho-sync] Phase2 contact error', { zohoId, err: String(err) });
			skipped++;
			syncLogBatch.push({
				instance_id: job.instance_id, direction: 'zoho_to_wix', entity_type: 'contact',
				wix_id: wixIdByZohoId.get(zohoId) ?? null, zoho_id: zohoId,
				status: 'error', skip_reason: null, error_message: String(err), sync_id: syncRunId,
			});
		}
	}

	// Flush all writes after the loop — deduplicate idMapBatch before upsert
	const dedupedIdMapBatch = Array.from(
		new Map(idMapBatch.map((r) => [`${r.instance_id}|${r.wix_id}|${r.entity_type}`, r])).values(),
	);
	console.log('[zoho-sync] Phase2: flushing writes', {
		jobId: job.id, idMap: idMapBatch.length, deduped: dedupedIdMapBatch.length,
		syncLog: syncLogBatch.length, created, updated, skipped,
	});
	if (dedupedIdMapBatch.length > 0) {
		const { error: upsertErr } = await supabase
			.from('contact_id_map')
			.upsert(dedupedIdMapBatch, { onConflict: 'instance_id,wix_id,entity_type' });
		if (upsertErr) {
			console.error('[zoho-sync] Phase2: contact_id_map upsert failed', {
				jobId: job.id, code: upsertErr.code, message: upsertErr.message,
				details: upsertErr.details, hint: upsertErr.hint, sampleRow: dedupedIdMapBatch[0],
			});
			throw new Error(`contact_id_map upsert failed: ${upsertErr.message} (code: ${upsertErr.code})`);
		}
		console.log('[zoho-sync] Phase2: contact_id_map upserted', { count: dedupedIdMapBatch.length, jobId: job.id });
	}
	if (syncLogBatch.length > 0) await supabase.from('sync_log').insert(syncLogBatch);

	// Back-stamp Wix_Contact_Id on newly created contacts' ZOHO record (1 ZOHO batch call).
	// This links the ZOHO contact to the Wix ID it now maps to, so future Phase 2 ticks
	// can find the link via Wix_Contact_Id even if contact_id_map is cleared.
	if (newContactStamps.length > 0) {
		const stampTs = Date.now();
		try {
			await fetch(`${zohoConfig.apiDomain}/crm/v2/Contacts`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}`,
				},
				body: JSON.stringify({
					data: newContactStamps.map(({ zohoId, wixId }) => ({
						id: zohoId,
						Wix_Contact_Id: wixId,
						Wix_Sync_Source: `wix_sync_${stampTs}`,
					})),
				}),
			});
		} catch (e) {
			// Non-fatal — Phase 1 will stamp Wix_Contact_Id on next sync
			console.warn('[zoho-sync] Phase2: Wix_Contact_Id back-stamp failed', String(e));
		}
	}

	const prevStats = (job.stats as Record<string, unknown>) ?? {};
	const stats = {
		...prevStats,
		phase2Created: ((prevStats.phase2Created as number | undefined) ?? 0) + created,
		phase2Updated: ((prevStats.phase2Updated as number | undefined) ?? 0) + updated,
		phase2Skipped: ((prevStats.phase2Skipped as number | undefined) ?? 0) + skipped,
	};

	if (hasMore) {
		console.log('[zoho-sync] Phase2: tick done — more pages remain', { jobId: job.id, nextPage: page + 1, stats });
		await supabase
			.from('sync_jobs')
			.update({ phase2_cursor: String(page + 1), status: 'running_phase2', stats, updated_at: now })
			.eq('id', job.id as string);
	} else {
		console.log('[zoho-sync] Phase2: all pages done — marking job done', { jobId: job.id, stats });
		await supabase
			.from('sync_jobs')
			.update({ phase2_done: true, phase2_cursor: null, status: 'done', stats, updated_at: now })
			.eq('id', job.id as string);
	}
}

// ── Queue routing ─────────────────────────────────────────────────────────────

async function enqueueSyncTick(env: Env, jobId: string): Promise<void> {
	await env.SYNC_QUEUE.send({ jobId });
	console.log('[zoho-sync] enqueueSyncTick: queued', { jobId });
}

async function runSyncTick(env: Env, jobId: string): Promise<void> {
	const supabase = getSupabase(env);

	const { data: job } = await supabase
		.from('sync_jobs')
		.select('*')
		.eq('id', jobId)
		.maybeSingle();

	if (!job) {
		console.error('[zoho-sync] runSyncTick: job not found', { jobId });
		return;
	}
	if (job.status === 'done' || job.status === 'failed') {
		console.log('[zoho-sync] runSyncTick: job already terminal — skipping', { jobId, status: job.status });
		return;
	}

	console.log('[zoho-sync] runSyncTick: processing', {
		jobId: job.id,
		status: job.status,
		phase1_done: job.phase1_done,
		phase2_done: job.phase2_done,
		cursor: job.phase2_cursor ?? null,
	});

	try {
		if (!job.phase1_done) {
			await processPhase1Tick(env, supabase, job as Record<string, unknown>);
			// Always enqueue next — processPhase1Tick sets phase1_done when complete,
			// so the next tick will naturally move to Phase 2.
			await enqueueSyncTick(env, jobId);
		} else if (!job.phase2_done) {
			await processPhase2Tick(env, supabase, job as Record<string, unknown>);
			// Re-fetch to check whether this was the last Phase 2 page
			const { data: updated } = await supabase
				.from('sync_jobs')
				.select('phase2_done')
				.eq('id', jobId)
				.maybeSingle();
			if (!updated?.phase2_done) {
				await enqueueSyncTick(env, jobId);
			} else {
				console.log('[zoho-sync] runSyncTick: Phase 2 complete', { jobId });
			}
		} else {
			await supabase
				.from('sync_jobs')
				.update({ status: 'done', updated_at: new Date().toISOString() })
				.eq('id', job.id as string);
			console.log('[zoho-sync] runSyncTick: job done', { jobId });
		}
	} catch (err) {
		console.error('[zoho-sync] runSyncTick error', { jobId, err: String(err) });
		await supabase
			.from('sync_jobs')
			.update({ status: 'failed', error: String(err), updated_at: new Date().toISOString() })
			.eq('id', jobId);
	}
}

// ── Worker entry point ────────────────────────────────────────────────────────

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/zoho/callback' && request.method === 'GET') {
			return handleCallback(request);
		}

		if (url.pathname === '/api/zoho/webhook' && request.method === 'POST') {
			return handleWebhook(request, env);
		}

		if (url.pathname === '/trigger-job' && request.method === 'POST') {
			try {
				let body: { jobId?: string };
				try { body = (await request.json()) as { jobId?: string }; }
				catch { return new Response('Invalid JSON', { status: 400 }); }

				if (!body.jobId) return new Response('jobId required', { status: 400 });

				const supabase = getSupabase(env);
				const { data: job } = await supabase
					.from('sync_jobs')
					.select('id, status')
					.eq('id', body.jobId)
					.maybeSingle();

				if (!job) return new Response('Job not found', { status: 404 });
				if (job.status !== 'pending')
					return new Response('Job already started', { status: 409 });

				await enqueueSyncTick(env, body.jobId);
				return new Response('OK', { status: 200 });
			} catch (err) {
				return new Response(String(err), { status: 500 });
			}
		}

		return new Response('Not found', { status: 404 });
	},

	// Queue consumer — each message is one sync tick (one Phase 1 or Phase 2 page).
	// max_batch_size=1 ensures each message gets its own invocation with a full CPU budget.
	// runSyncTick catches its own errors and marks jobs failed — no retry needed here.
	async queue(batch: MessageBatch<{ jobId: string }>, env: Env): Promise<void> {
		for (const message of batch.messages) {
			const { jobId } = message.body;
			console.log('[zoho-sync] queue: processing message', { jobId });
			await runSyncTick(env, jobId);
			message.ack();
		}
	},

	// Cron — runs every minute.
	// 1. Renews any Zoho webhook channels expiring within 2 days (keeps real-time sync alive).
	// 2. Re-queues at most ONE stalled/pending sync job (stall-recovery).
	async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
		await renewExpiringChannels(env);

		const supabase = getSupabase(env);
		const stalledBefore = new Date(Date.now() - 120_000).toISOString();
		const { data: job } = await supabase
			.from('sync_jobs')
			.select('id, status')
			.or(`status.eq.pending,and(status.like.running%,updated_at.lt.${stalledBefore})`)
			.order('created_at', { ascending: true })
			.limit(1)
			.maybeSingle();
		if (job) {
			console.log('[zoho-sync] cron: re-queuing job', { jobId: job.id, status: job.status });
			await enqueueSyncTick(env, job.id as string);
		} else {
			console.log('[zoho-sync] cron: no pending/stalled jobs');
		}
	},
} satisfies ExportedHandler<Env>;
