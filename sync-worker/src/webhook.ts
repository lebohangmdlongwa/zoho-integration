import { createClient } from '@supabase/supabase-js';
import { handleDealsWebhook } from './deals-webhook';

// Subset of index.ts Env — structurally compatible via TypeScript structural typing
export interface WebhookEnv {
	ZOHO_CLIENT_ID: string;
	ZOHO_CLIENT_SECRET: string;
	ZOHO_CHANNEL_TOKEN: string;
	WIX_CLIENT_ID: string;
	WIX_CLIENT_SECRET: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
}

const WIX_CONTACTS_API = 'https://www.wixapis.com/contacts/v4/contacts';

// ── Supabase ──────────────────────────────────────────────────────────────────

function getSupabase(env: WebhookEnv) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Wix helpers ───────────────────────────────────────────────────────────────

const wixTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getWixAccessToken(env: WebhookEnv, instanceId: string): Promise<string> {
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

async function wixApiHeaders(env: WebhookEnv, instanceId: string, siteId: string): Promise<Record<string, string>> {
	const token = await getWixAccessToken(env, instanceId);
	return { Authorization: `Bearer ${token}`, 'wix-site-id': siteId, 'Content-Type': 'application/json' };
}

async function wixGetContact(env: WebhookEnv, instanceId: string, siteId: string, contactId: string) {
	const res = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
		headers: await wixApiHeaders(env, instanceId, siteId),
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`wixGetContact ${res.status}: ${await res.text()}`);
	const { contact } = (await res.json()) as { contact: { id: string; revision: number; info: Record<string, unknown> } };
	return contact;
}

async function wixUpdateContact(env: WebhookEnv, instanceId: string, siteId: string, contactId: string, revision: number, info: Record<string, unknown>): Promise<void> {
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
			// Another contact already owns this phone — strip it and save the rest
			const { phones: _p, ...infoNoPhone } = info as Record<string, unknown> & { phones?: unknown };
			const retry = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
				method: 'PATCH',
				headers,
				body: JSON.stringify({ revision, info: infoNoPhone }),
			});
			if (!retry.ok) throw new Error(`wixUpdateContact phoneRetry ${retry.status}: ${await retry.text()}`);
			return;
		}
		// INVALID_REVISION — re-fetch live revision and retry
		const fresh = await wixGetContact(env, instanceId, siteId, contactId);
		if (!fresh) throw new Error(`wixUpdateContact 409: contact ${contactId} not found on re-fetch`);
		const retry = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ revision: fresh.revision, info }),
		});
		if (!retry.ok) throw new Error(`wixUpdateContact retry ${retry.status}: ${await retry.text()}`);
		return;
	}
	if (!res.ok) throw new Error(`wixUpdateContact ${res.status}: ${await res.text()}`);
}

async function wixCreateContact(env: WebhookEnv, instanceId: string, siteId: string, info: Record<string, unknown>): Promise<string | null> {
	const res = await fetch(WIX_CONTACTS_API, {
		method: 'POST',
		headers: await wixApiHeaders(env, instanceId, siteId),
		body: JSON.stringify({ info }),
	});
	if (res.status === 409) {
		const body = (await res.json()) as { details?: { applicationError?: { data?: { duplicateContactId?: string } } } };
		const existingId = body?.details?.applicationError?.data?.duplicateContactId;
		if (!existingId) throw new Error('wixCreateContact 409 but no duplicateContactId');
		const existing = await wixGetContact(env, instanceId, siteId, existingId);
		if (!existing) throw new Error(`wixCreateContact 409: existing contact ${existingId} not found`);
		await wixUpdateContact(env, instanceId, siteId, existingId, existing.revision, info);
		return existingId;
	}
	if (!res.ok) throw new Error(`wixCreateContact ${res.status}: ${await res.text()}`);
	const data = (await res.json()) as { contact?: { id?: string } };
	return data.contact?.id ?? null;
}

async function wixDeleteContact(env: WebhookEnv, instanceId: string, siteId: string, contactId: string): Promise<void> {
	const res = await fetch(`${WIX_CONTACTS_API}/${contactId}`, {
		method: 'DELETE',
		headers: await wixApiHeaders(env, instanceId, siteId),
	});
	if (res.status === 404) {
		console.log('[zoho-sync] wixDeleteContact: already gone', { contactId, instanceId });
		return;
	}
	if (!res.ok) throw new Error(`wixDeleteContact ${res.status}: ${await res.text()}`);
	console.log('[zoho-sync] wixDeleteContact: deleted', { contactId, instanceId });
}

// ── ZOHO helpers ──────────────────────────────────────────────────────────────

interface ZohoConfig {
	zohoToken: string;
	apiDomain: string;
	siteId: string;
}

async function getZohoConfig(env: WebhookEnv, instanceId: string): Promise<ZohoConfig> {
	const sb = getSupabase(env);
	const { data } = await sb
		.from('zoho_tokens')
		.select('access_token, refresh_token, expires_at, api_domain, dc, site_id')
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
		await sb.from('zoho_tokens').update({ access_token: token, expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000 }).eq('instance_id', instanceId);
	}

	return {
		zohoToken: token,
		apiDomain: (data.api_domain as string | null) ?? 'https://www.zohoapis.com',
		siteId: (data.site_id as string | null) ?? instanceId,
	};
}

async function zohoFetchContact(zohoConfig: ZohoConfig, zohoId: string): Promise<Record<string, unknown> | null> {
	const res = await fetch(`${zohoConfig.apiDomain}/crm/v2/Contacts/${zohoId}`, {
		headers: { Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` },
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`zohoFetchContact ${res.status}: ${await res.text()}`);
	const data = (await res.json()) as { data?: Record<string, unknown>[] };
	return data.data?.[0] ?? null;
}

// ── Field mapping ─────────────────────────────────────────────────────────────

type FieldMapping = { wixField: string; zohoProp: string; direction: string; transform?: string };

function applyTransform(value: string, transform?: string): string {
	if (transform === 'lowercase') return value.toLowerCase();
	if (transform === 'trim') return value.trim();
	if (transform === 'uppercase') return value.toUpperCase();
	return value;
}

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
	'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'andorra': 'AD', 'angola': 'AO',
	'argentina': 'AR', 'armenia': 'AM', 'australia': 'AU', 'austria': 'AT', 'azerbaijan': 'AZ',
	'bahrain': 'BH', 'bangladesh': 'BD', 'belarus': 'BY', 'belgium': 'BE', 'benin': 'BJ',
	'bolivia': 'BO', 'bosnia and herzegovina': 'BA', 'botswana': 'BW', 'brazil': 'BR',
	'bulgaria': 'BG', 'burkina faso': 'BF', 'cameroon': 'CM', 'canada': 'CA', 'chile': 'CL',
	'china': 'CN', 'colombia': 'CO', 'congo': 'CG', 'costa rica': 'CR', 'croatia': 'HR',
	'cuba': 'CU', 'cyprus': 'CY', 'czech republic': 'CZ', 'czechia': 'CZ', 'denmark': 'DK',
	'dominican republic': 'DO', 'ecuador': 'EC', 'egypt': 'EG', 'el salvador': 'SV',
	'estonia': 'EE', 'ethiopia': 'ET', 'finland': 'FI', 'france': 'FR', 'georgia': 'GE',
	'germany': 'DE', 'ghana': 'GH', 'greece': 'GR', 'guatemala': 'GT', 'honduras': 'HN',
	'hungary': 'HU', 'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID', 'iran': 'IR',
	'iraq': 'IQ', 'ireland': 'IE', 'israel': 'IL', 'italy': 'IT', 'ivory coast': 'CI',
	'jamaica': 'JM', 'japan': 'JP', 'jordan': 'JO', 'kazakhstan': 'KZ', 'kenya': 'KE',
	'kuwait': 'KW', 'latvia': 'LV', 'lebanon': 'LB', 'libya': 'LY', 'lithuania': 'LT',
	'luxembourg': 'LU', 'madagascar': 'MG', 'malaysia': 'MY', 'mali': 'ML', 'malta': 'MT',
	'mauritius': 'MU', 'mexico': 'MX', 'moldova': 'MD', 'mongolia': 'MN', 'morocco': 'MA',
	'mozambique': 'MZ', 'myanmar': 'MM', 'namibia': 'NA', 'nepal': 'NP', 'netherlands': 'NL',
	'new zealand': 'NZ', 'nicaragua': 'NI', 'niger': 'NE', 'nigeria': 'NG', 'north korea': 'KP',
	'norway': 'NO', 'oman': 'OM', 'pakistan': 'PK', 'panama': 'PA', 'paraguay': 'PY',
	'peru': 'PE', 'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT', 'qatar': 'QA',
	'romania': 'RO', 'russia': 'RU', 'russian federation': 'RU', 'rwanda': 'RW',
	'saudi arabia': 'SA', 'senegal': 'SN', 'serbia': 'RS', 'singapore': 'SG', 'slovakia': 'SK',
	'slovenia': 'SI', 'somalia': 'SO', 'south africa': 'ZA', 'south korea': 'KR', 'spain': 'ES',
	'sri lanka': 'LK', 'sudan': 'SD', 'sweden': 'SE', 'switzerland': 'CH', 'syria': 'SY',
	'taiwan': 'TW', 'tanzania': 'TZ', 'thailand': 'TH', 'tunisia': 'TN', 'turkey': 'TR',
	'turkiye': 'TR', 'uganda': 'UG', 'ukraine': 'UA', 'united arab emirates': 'AE', 'uae': 'AE',
	'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'england': 'GB',
	'united states': 'US', 'usa': 'US', 'united states of america': 'US', 'uruguay': 'UY',
	'uzbekistan': 'UZ', 'venezuela': 'VE', 'vietnam': 'VN', 'viet nam': 'VN',
	'yemen': 'YE', 'zambia': 'ZM', 'zimbabwe': 'ZW',
};

function toIso2Country(value: string): string | null {
	if (/^[A-Z]{2}$/.test(value)) return value;
	return COUNTRY_NAME_TO_ISO2[value.toLowerCase()] ?? null;
}

const CALLING_CODE: Record<string, string> = {
	AF:'93',AL:'355',DZ:'213',AD:'376',AO:'244',AG:'1268',AR:'54',AM:'374',AU:'61',AT:'43',
	AZ:'994',BS:'1242',BH:'973',BD:'880',BB:'1246',BY:'375',BE:'32',BZ:'501',BJ:'229',
	BT:'975',BO:'591',BA:'387',BW:'267',BR:'55',BN:'673',BG:'359',BF:'226',BI:'257',
	CV:'238',KH:'855',CM:'237',CA:'1',CF:'236',TD:'235',CL:'56',CN:'86',CO:'57',KM:'269',
	CD:'243',CG:'242',CR:'506',HR:'385',CU:'53',CY:'357',CZ:'420',DK:'45',DJ:'253',
	DM:'1767',DO:'1809',EC:'593',EG:'20',SV:'503',GQ:'240',ER:'291',EE:'372',SZ:'268',
	ET:'251',FJ:'679',FI:'358',FR:'33',GA:'241',GM:'220',GE:'995',DE:'49',GH:'233',
	GR:'30',GD:'1473',GT:'502',GN:'224',GW:'245',GY:'592',HT:'509',HN:'504',HU:'36',
	IS:'354',IN:'91',ID:'62',IR:'98',IQ:'964',IE:'353',IL:'972',IT:'39',JM:'1876',
	JP:'81',JO:'962',KZ:'7',KE:'254',KI:'686',KP:'850',KR:'82',KW:'965',KG:'996',
	LA:'856',LV:'371',LB:'961',LS:'266',LR:'231',LY:'218',LI:'423',LT:'370',LU:'352',
	MG:'261',MW:'265',MY:'60',MV:'960',ML:'223',MT:'356',MH:'692',MR:'222',MU:'230',
	MX:'52',FM:'691',MD:'373',MC:'377',MN:'976',ME:'382',MA:'212',MZ:'258',MM:'95',
	NA:'264',NR:'674',NP:'977',NL:'31',NZ:'64',NI:'505',NE:'227',NG:'234',NO:'47',
	OM:'968',PK:'92',PW:'680',PA:'507',PG:'675',PY:'595',PE:'51',PH:'63',PL:'48',
	PT:'351',QA:'974',RO:'40',RU:'7',RW:'250',KN:'1869',LC:'1758',VC:'1784',WS:'685',
	SM:'378',ST:'239',SA:'966',SN:'221',RS:'381',SC:'248',SL:'232',SG:'65',SK:'421',
	SI:'386',SB:'677',SO:'252',ZA:'27',SS:'211',ES:'34',LK:'94',SD:'249',SR:'597',
	SE:'46',CH:'41',SY:'963',TW:'886',TJ:'992',TZ:'255',TH:'66',TL:'670',TG:'228',
	TO:'676',TT:'1868',TN:'216',TR:'90',TM:'993',TV:'688',UG:'256',UA:'380',AE:'971',
	GB:'44',US:'1',UY:'598',UZ:'998',VU:'678',VE:'58',VN:'84',YE:'967',ZM:'260',ZW:'263',
};

function stripCallingCode(phone: string, iso2: string): string {
	const code = CALLING_CODE[iso2];
	if (code && phone.startsWith(code) && phone.length > code.length) {
		return phone.slice(code.length);
	}
	return phone;
}

async function getFieldMappings(env: WebhookEnv, instanceId: string): Promise<FieldMapping[]> {
	const { data } = await getSupabase(env)
		.from('contact_field_mappings')
		.select('mappings')
		.eq('instance_id', instanceId)
		.single();
	const saved: FieldMapping[] = (data?.mappings as FieldMapping[]) ?? [];
	const defaults: FieldMapping[] = [
		{ wixField: 'info.name.first',               zohoProp: 'First_Name',    direction: 'bidirectional' },
		{ wixField: 'info.name.last',                zohoProp: 'Last_Name',     direction: 'bidirectional' },
		{ wixField: 'info.emails[0].email',          zohoProp: 'Email',         direction: 'bidirectional' },
		{ wixField: 'info.phones[0].phone',          zohoProp: 'Phone',         direction: 'bidirectional' },
		{ wixField: 'info.company.name',             zohoProp: 'Account_Name',  direction: 'bidirectional' },
		{ wixField: 'info.name.prefix',              zohoProp: 'Title',         direction: 'bidirectional' },
		{ wixField: 'info.addresses[0].addressLine', zohoProp: 'Mailing_Street',  direction: 'bidirectional' },
		{ wixField: 'info.addresses[0].city',        zohoProp: 'Mailing_City',    direction: 'bidirectional' },
		{ wixField: 'info.addresses[0].subdivision', zohoProp: 'Mailing_State',   direction: 'bidirectional' },
		{ wixField: 'info.addresses[0].postalCode',  zohoProp: 'Mailing_Zip',     direction: 'bidirectional' },
		{ wixField: 'info.addresses[0].country',     zohoProp: 'Mailing_Country', direction: 'bidirectional' },
		{ wixField: 'info.addresses[0].addressLine', zohoProp: 'Other_Street',    direction: 'zoho_to_wix' },
		{ wixField: 'info.addresses[0].city',        zohoProp: 'Other_City',      direction: 'zoho_to_wix' },
		{ wixField: 'info.addresses[0].subdivision', zohoProp: 'Other_State',     direction: 'zoho_to_wix' },
		{ wixField: 'info.addresses[0].postalCode',  zohoProp: 'Other_Zip',       direction: 'zoho_to_wix' },
		{ wixField: 'info.addresses[0].country',     zohoProp: 'Other_Country',   direction: 'zoho_to_wix' },
	];
	return saved.length ? saved : defaults;
}

function buildWixInfo(zohoContact: Record<string, unknown>, mappings: FieldMapping[]): Record<string, unknown> {
	const info: Record<string, unknown> = {};
	const applicable = mappings.filter((m) => m.direction === 'zoho_to_wix' || m.direction === 'bidirectional');

	for (const m of applicable) {
		const raw = zohoContact[m.zohoProp];
		if (!raw) continue;
		const rawStr: string = typeof raw === 'object' && raw !== null && 'name' in (raw as object)
			? (raw as { name: string }).name
			: String(raw);
		if (!rawStr) continue;
		const value = applyTransform(rawStr, m.transform);

		switch (m.wixField) {
			case 'info.name.first':
				(info.name as any) ??= {};
				(info.name as any).first = value;
				break;
			case 'info.name.last':
				(info.name as any) ??= {};
				(info.name as any).last = value;
				break;
			case 'info.emails[0].email':
				if (value.endsWith('.invalid') || value.endsWith('.test') || value.endsWith('.example')) break;
				info.emails = { items: [{ email: value, tag: 'MAIN' }] };
				break;
			case 'info.phones[0].phone':
				info.phones = { items: [{ phone: value, tag: 'MAIN' }] };
				break;
			case 'info.company.name':
				info.company = { name: value };
				break;
			case 'info.name.prefix':
				(info.name as any) ??= {};
				(info.name as any).prefix = value;
				break;
			case 'info.addresses[0].addressLine':
			case 'info.addresses[0].city':
			case 'info.addresses[0].subdivision':
			case 'info.addresses[0].postalCode':
			case 'info.addresses[0].country': {
				const field = m.wixField.split('.').pop()!;
				const finalValue = field === 'country' ? toIso2Country(value) : value;
				if (field === 'country' && finalValue === null) break;
				if (!info.addresses) info.addresses = { items: [{ tag: 'HOME', address: {} }] };
				const addrObj = (info.addresses as any).items[0].address as Record<string, string>;
				if (!addrObj[field]) addrObj[field] = finalValue!;
				break;
			}
		}
	}

	// Set countryCode on phone and strip the calling-code prefix using the address country (already ISO2)
	const addrCountry = (info.addresses as any)?.items?.[0]?.address?.country as string | undefined;
	if (addrCountry && (info.phones as any)?.items?.[0]) {
		const phoneItem = (info.phones as any).items[0];
		phoneItem.countryCode = addrCountry;
		if (typeof phoneItem.phone === 'string') {
			phoneItem.phone = stripCallingCode(phoneItem.phone, addrCountry);
		}
	}

	return info;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getTokenByChannelId(supabase: ReturnType<typeof getSupabase>, channelId: string) {
	const { data } = await supabase.from('zoho_tokens').select('*').eq('channel_id', channelId).single();
	return data ?? null;
}

async function markEventProcessed(supabase: ReturnType<typeof getSupabase>, eventId: string): Promise<boolean> {
	const { error } = await supabase.from('processed_events').insert({ event_id: eventId, processed_at: new Date().toISOString() });
	if (!error) return true;
	if ((error as { code?: string }).code === '23505') return false;
	return true;
}

async function getIdMapByZohoId(supabase: ReturnType<typeof getSupabase>, instanceId: string, zohoId: string) {
	const { data } = await supabase.from('contact_id_map').select('wix_id, zoho_id, last_sync_source, last_synced_at').eq('instance_id', instanceId).eq('zoho_id', zohoId).single();
	return data ?? null;
}

async function getIdMapByWixId(supabase: ReturnType<typeof getSupabase>, instanceId: string, wixId: string) {
	const { data } = await supabase.from('contact_id_map').select('wix_id, zoho_id').eq('instance_id', instanceId).eq('wix_id', wixId).single();
	return data ?? null;
}

function isOwnWrite(wixSyncSource: string | undefined): boolean {
	if (!wixSyncSource?.startsWith('wix_sync_')) return false;
	const ts = parseInt(wixSyncSource.replace('wix_sync_', ''), 10);
	return Date.now() - ts < 5 * 60 * 1000;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export function handleCallback(request: Request): Response {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	console.log('[zoho-sync] callback: received', { hasCode: !!code, hasError: !!error, error: error ?? null });

	const codeJson = JSON.stringify(code ?? '');
	const errorJson = JSON.stringify(error ?? '');
	const html = `<!DOCTYPE html>
<html><head><title>Connecting to ZOHO CRM...</title></head>
<body>
  <p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#667085;">
    ${error ? 'Connection failed. You can close this window.' : 'Connecting to ZOHO CRM…'}
  </p>
  <script>
    if (window.opener) {
      ${error
		? `window.opener.postMessage({ type: 'zoho-error', error: ${errorJson} }, '*');`
		: `window.opener.postMessage({ type: 'zoho-code', code: ${codeJson} }, '*');`}
    }
  </script>
</body></html>`;

	return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

type ZohoWebhookPayload = {
	channel_id?: string | number;
	query_params?: { channel_id?: string };
	module?: string;
	operation?: 'insert' | 'update' | 'delete' | 'edit' | 'create';
	ids?: string[];
	token?: string;
	server_time?: number;
	affected_fields?: Array<{ [zohoId: string]: string[] }>;
};

export async function handleWebhook(request: Request, env: WebhookEnv): Promise<Response> {
	const rawBody = await request.text();
	console.log('[zoho-sync] webhook: raw payload', { body: rawBody.slice(0, 500) });

	let payload: ZohoWebhookPayload;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		console.error('[zoho-sync] webhook: invalid JSON', { body: rawBody.slice(0, 200) });
		return new Response('Invalid JSON', { status: 400 });
	}

	if (env.ZOHO_CHANNEL_TOKEN && payload.token !== env.ZOHO_CHANNEL_TOKEN) {
		console.warn('[zoho-sync] webhook: invalid channel token', { received: payload.token });
		return new Response('Invalid token', { status: 401 });
	}

	const channelId = String(payload.channel_id ?? payload.query_params?.channel_id ?? '');
	const operation = payload.operation;
	const ids = payload.ids ?? [];
	const serverTime = payload.server_time ?? 0;

	console.log('[zoho-sync] webhook: parsed payload', {
		channelId, operation, module: payload.module, contactCount: ids.length, ids,
	});

	if (!channelId || !operation || !ids.length) {
		console.log('[zoho-sync] webhook: skipped — missing channelId/operation/ids');
		return Response.json({ ok: true });
	}
	if (payload.module !== 'Contacts' && payload.module !== 'Deals') {
		console.log('[zoho-sync] webhook: skipped — unsupported module', { module: payload.module });
		return Response.json({ ok: true });
	}

	// Build a map of zohoId → changed field names so we can detect bounce-backs
	// before making any external API calls.
	const OWN_WRITE_FIELDS = new Set(['Wix_Contact_Id', 'Wix_Sync_Source']);
	const affectedFieldsMap = new Map<string, string[]>();
	for (const entry of (payload.affected_fields ?? [])) {
		for (const [id, fields] of Object.entries(entry)) {
			affectedFieldsMap.set(id, fields);
		}
	}

	const supabase = getSupabase(env);

	// Deals are handled by a dedicated module — delegate and return early.
	if (payload.module === 'Deals') {
		const tokenRow = await getTokenByChannelId(supabase, channelId);
		if (!tokenRow) return Response.json({ ok: true });
		const instanceId = tokenRow.instance_id as string;
		const siteId = tokenRow.site_id as string | null;
		if (!siteId) return Response.json({ ok: true });
		await handleDealsWebhook(env, instanceId, siteId, operation ?? '', ids, channelId, serverTime);
		console.log('[zoho-sync] webhook: done processing deals', { channelId, operation, dealCount: ids.length, instanceId });
		return Response.json({ ok: true });
	}

	const tokenRow = await getTokenByChannelId(supabase, channelId);
	console.log('[zoho-sync] webhook: instance lookup', {
		channelId, found: !!tokenRow, instanceId: (tokenRow?.instance_id as string) ?? null,
	});
	if (!tokenRow) return Response.json({ ok: true });

	const instanceId = tokenRow.instance_id as string;
	const siteId = tokenRow.site_id as string | null;
	if (!siteId) {
		console.warn('[zoho-sync] webhook: no siteId for instance — reconnect required', { instanceId });
		return Response.json({ ok: true });
	}

	const [zohoConfig, mappings] = await Promise.all([
		getZohoConfig(env, instanceId),
		getFieldMappings(env, instanceId),
	]);

	for (const zohoId of ids) {
		// If the only changed fields are Wix_Contact_Id / Wix_Sync_Source this is our own
		// write-back from a previous sync tick — skip before touching any DB or ZOHO API.
		const changedFields = affectedFieldsMap.get(zohoId) ?? [];
		if (changedFields.length > 0 && changedFields.every(f => OWN_WRITE_FIELDS.has(f))) {
			console.log('[zoho-sync] webhook: skip — own-field bounce-back', { zohoId, changedFields });
			continue;
		}

		const eventKey = `${channelId}:${operation}:${zohoId}:${serverTime}`;
		console.log('[zoho-sync] webhook: processing contact', { zohoId, operation, instanceId, eventKey });
		const isNew = await markEventProcessed(supabase, eventKey);
		if (!isNew) {
			console.log('[zoho-sync] webhook: duplicate event — skipped', { eventKey });
			continue;
		}

		try {
			const syncId = crypto.randomUUID();

			if (operation === 'delete') {
				const idMap = await getIdMapByZohoId(supabase, instanceId, zohoId);
				if (idMap?.wix_id) {
					await wixDeleteContact(env, instanceId, zohoConfig.siteId, idMap.wix_id);
					await supabase.from('contact_id_map')
						.delete()
						.eq('instance_id', instanceId)
						.eq('zoho_id', zohoId);
					await supabase.from('sync_log').insert({
						instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
						wix_id: idMap.wix_id, zoho_id: zohoId, status: 'success',
						skip_reason: null, error_message: null, sync_id: syncId,
					});
					console.log('[zoho-sync] webhook: deleted wix contact', { zohoId, wixId: idMap.wix_id, instanceId });
				} else {
					console.log('[zoho-sync] webhook: delete — no linked wix contact', { zohoId, instanceId });
				}
				continue;
			}

			const contact = await zohoFetchContact(zohoConfig, zohoId);
			console.log('[zoho-sync] webhook: zoho contact fetched', {
				zohoId, found: !!contact,
				name: contact ? `${contact.First_Name ?? ''} ${contact.Last_Name ?? ''}`.trim() : null,
			});
			if (!contact) continue;

			if (isOwnWrite(contact.Wix_Sync_Source as string | undefined)) {
				await supabase.from('sync_log').insert({
					instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
					wix_id: null, zoho_id: zohoId, status: 'skipped',
					skip_reason: 'own_write_correlation_id', error_message: null, sync_id: syncId,
				});
				continue;
			}

			const wixInfo = buildWixInfo(contact, mappings);
			const idMap = await getIdMapByZohoId(supabase, instanceId, zohoId);
			console.log('[zoho-sync] webhook: idMap lookup', {
				zohoId, found: !!idMap, existingWixId: idMap?.wix_id ?? null,
				wixInfoKeys: Object.keys(wixInfo),
			});

			if (idMap) {
				const lastSyncMs = new Date(idMap.last_synced_at as string).getTime();
				if (idMap.last_sync_source === 'wix' && Date.now() - lastSyncMs < 5 * 60 * 1000) {
					await supabase.from('sync_log').insert({
						instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
						wix_id: idMap.wix_id, zoho_id: zohoId, status: 'skipped',
						skip_reason: 'db_timestamp_guard', error_message: null, sync_id: syncId,
					});
					continue;
				}
				const existing = await wixGetContact(env, instanceId, siteId, idMap.wix_id);
				console.log('[zoho-sync] webhook: updating existing wix contact', { zohoId, wixId: idMap.wix_id, revision: existing?.revision ?? null });
				if (existing && Object.keys(wixInfo).length > 0) {
					await wixUpdateContact(env, instanceId, siteId, idMap.wix_id, existing.revision, wixInfo);
					console.log('[zoho-sync] webhook: wix contact updated', { zohoId, wixId: idMap.wix_id });
				}
				await supabase.from('contact_id_map')
					.update({ last_sync_source: 'zoho', last_synced_at: new Date().toISOString(), last_sync_id: syncId })
					.eq('instance_id', instanceId).eq('zoho_id', zohoId);
				await supabase.from('sync_log').insert({
					instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
					wix_id: idMap.wix_id, zoho_id: zohoId, status: 'success',
					skip_reason: null, error_message: null, sync_id: syncId,
				});
			} else {
				const existingWixId = contact.Wix_Contact_Id as string | undefined;

				if (existingWixId) {
					const reverseMap = await getIdMapByWixId(supabase, instanceId, existingWixId);
					if (!reverseMap) {
						await supabase.from('sync_log').insert({
							instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
							wix_id: existingWixId, zoho_id: zohoId, status: 'skipped',
							skip_reason: 'sync_link_removed', error_message: null, sync_id: syncId,
						});
						continue;
					}
					if (Object.keys(wixInfo).length > 0) {
						const existing = await wixGetContact(env, instanceId, siteId, existingWixId);
						if (existing) await wixUpdateContact(env, instanceId, siteId, existingWixId, existing.revision, wixInfo);
					}
					await supabase.from('contact_id_map').upsert(
						{ instance_id: instanceId, wix_id: existingWixId, zoho_id: zohoId, entity_type: 'contact', last_sync_source: 'zoho', last_synced_at: new Date().toISOString(), last_sync_id: syncId },
						{ onConflict: 'instance_id,wix_id,entity_type' },
					);
					await supabase.from('sync_log').insert({
						instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
						wix_id: existingWixId, zoho_id: zohoId, status: 'success',
						skip_reason: null, error_message: null, sync_id: syncId,
					});
				} else if ((contact.Wix_Sync_Source as string | undefined)?.startsWith('wix_sync_')) {
					await supabase.from('sync_log').insert({
						instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
						wix_id: null, zoho_id: zohoId, status: 'skipped',
						skip_reason: 'wix_origin_no_id', error_message: null, sync_id: syncId,
					});
				} else {
					if (!Object.keys(wixInfo).length) {
						await supabase.from('sync_log').insert({
							instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
							wix_id: null, zoho_id: zohoId, status: 'skipped',
							skip_reason: 'no_mapped_fields', error_message: null, sync_id: syncId,
						});
						continue;
					}
					const newWixId = await wixCreateContact(env, instanceId, siteId, wixInfo);
					console.log('[zoho-sync] webhook: wix contact created', { zohoId, newWixId });
					if (!newWixId) continue;
					await supabase.from('contact_id_map').upsert(
						{ instance_id: instanceId, wix_id: newWixId, zoho_id: zohoId, entity_type: 'contact', last_sync_source: 'zoho', last_synced_at: new Date().toISOString(), last_sync_id: syncId },
						{ onConflict: 'instance_id,wix_id,entity_type' },
					);
					try {
						await fetch(`${zohoConfig.apiDomain}/crm/v2/Contacts`, {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json', Authorization: `Zoho-oauthtoken ${zohoConfig.zohoToken}` },
							body: JSON.stringify({ data: [{ id: zohoId, Wix_Contact_Id: newWixId, Wix_Sync_Source: `wix_sync_${Date.now()}` }] }),
						});
						console.log('[zoho-sync] webhook: back-stamped Wix_Contact_Id on ZOHO', { zohoId, newWixId });
					} catch (stampErr) {
						console.warn('[zoho-sync] webhook: back-stamp failed (non-fatal)', { zohoId, err: String(stampErr) });
					}
					await supabase.from('sync_log').insert({
						instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
						wix_id: newWixId, zoho_id: zohoId, status: 'success',
						skip_reason: null, error_message: null, sync_id: syncId,
					});
				}
			}
		} catch (err) {
			console.error('[zoho-webhook] event processing failed', { zohoId, err: String(err) });
			try {
				await supabase.from('sync_log').insert({
					instance_id: instanceId, direction: 'zoho_to_wix', entity_type: 'contact',
					wix_id: null, zoho_id: zohoId, status: 'error',
					skip_reason: null, error_message: String(err), sync_id: null,
				});
			} catch { /* suppress */ }
		}
	}

	console.log('[zoho-sync] webhook: done processing', { channelId, operation, contactCount: ids.length, instanceId });
	return Response.json({ ok: true });
}
