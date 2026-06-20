import { getToken, updateToken } from "./_shared/db.ts";
import { logger } from "./logger.ts";

// ── DC / accounts URL helpers ─────────────────────────────────────

function deriveDC(apiDomain: string): string {
  if (apiDomain.includes("zohocloud.ca")) return "zohocloud.ca";
  const match = apiDomain.match(/zohoapis\.(.+)$/);
  return match?.[1] ?? "com";
}

export function accountsUrl(dc: string): string {
  if (dc === "zohocloud.ca") return "https://accounts.zohocloud.ca";
  return `https://accounts.zoho.${dc}`;
}

export function deriveDCFromApiDomain(apiDomain: string): string {
  return deriveDC(apiDomain);
}

// ── Local types ───────────────────────────────────────────────────

export type ZohoContext = {
  instanceId: string;
  token: StoredToken;
};

type ZohoListResponse<T> = {
  data: T[];
  info?: {
    page: number;
    per_page: number;
    count: number;
    more_records: boolean;
  };
};

type ZohoFieldsResponse = {
  fields: Array<{ api_name: string; field_label: string; data_type: string }>;
};

// ── Internal helpers ──────────────────────────────────────────────

async function refreshTokenIfNeeded(ctx: ZohoContext): Promise<void> {
  const fiveMin = 5 * 60 * 1000;
  if (Date.now() < ctx.token.expires_at - fiveMin) return;

  const dc = ctx.token.dc ?? "com";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: (import.meta.env.ZOHO_CLIENT_ID ?? process.env.ZOHO_CLIENT_ID)!,
    client_secret: (import.meta.env.ZOHO_CLIENT_SECRET ??
      process.env.ZOHO_CLIENT_SECRET)!,
    refresh_token: ctx.token.refresh_token
  });

  const res = await fetch(`${accountsUrl(dc)}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!res.ok) throw new Error(`ZOHO token refresh failed: ${res.status}`);

  const data: ZohoTokenResponse = await res.json();
  const patch: Partial<StoredToken> = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000
  };
  // ZOHO refresh may return a new refresh_token — store it if present
  if (data.refresh_token) patch.refresh_token = data.refresh_token;

  await updateToken(ctx.instanceId, patch);
  ctx.token = { ...ctx.token, ...patch };
}

export async function zohoFetch<T>(
  ctx: ZohoContext,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  await refreshTokenIfNeeded(ctx);
  const base = `${ctx.token.api_domain}/crm/v2`;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${ctx.token.access_token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error("[zoho] API error", {
      method: init.method ?? "GET",
      path,
      status: res.status,
      body
    });
    throw new Error(
      `ZOHO ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`
    );
  }
  // 204 No Content — Zoho search endpoints return this when no records match.
  // Some endpoints also return 200 with an empty body — handle both to avoid SyntaxError.
  if (res.status === 204) return {} as T;
  const text = await res.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

// ── Public factory ────────────────────────────────────────────────

export async function createZohoContext(
  instanceId: string
): Promise<ZohoContext> {
  const token = await getToken(instanceId);
  if (!token) throw new Error(`ZOHO not connected for instance: ${instanceId}`);
  if (!token.api_domain)
    throw new Error(`ZOHO api_domain missing for instance: ${instanceId}`);
  const ctx: ZohoContext = { instanceId, token };
  await refreshTokenIfNeeded(ctx);
  return ctx;
}

// ── Org info ──────────────────────────────────────────────────────

export async function getOrgId(ctx: ZohoContext): Promise<string | null> {
  const data = await zohoFetch<{ org: Array<{ zgid: string }> }>(ctx, "/org");
  return data.org?.[0]?.zgid ?? null;
}

// ── Contacts ──────────────────────────────────────────────────────

export async function searchContactByEmail(
  ctx: ZohoContext,
  email: string
): Promise<ZohoContact | null> {
  try {
    const encoded = encodeURIComponent(`(Email:equals:${email})`);
    const result = await zohoFetch<ZohoListResponse<ZohoContact>>(
      ctx,
      `/Contacts/search?criteria=${encoded}`
    );
    return result.data?.[0] ?? null;
  } catch (err) {
    // ZOHO returns 204 / no data when nothing matches — treat as null
    if (String(err).includes("204") || String(err).includes("no data"))
      return null;
    throw err;
  }
}

export async function searchContactByWixId(
  ctx: ZohoContext,
  wixContactId: string
): Promise<ZohoContact | null> {
  try {
    const encoded = encodeURIComponent(
      `(Wix_Contact_Id:equals:${wixContactId})`
    );
    const result = await zohoFetch<ZohoListResponse<ZohoContact>>(
      ctx,
      `/Contacts/search?criteria=${encoded}`
    );
    return result.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getContact(
  ctx: ZohoContext,
  id: string
): Promise<ZohoContact | null> {
  try {
    const result = await zohoFetch<ZohoListResponse<ZohoContact>>(
      ctx,
      `/Contacts/${id}`
    );
    return result.data?.[0] ?? null;
  } catch (err) {
    if (String(err).includes("404")) return null;
    throw err;
  }
}

export async function createContact(
  ctx: ZohoContext,
  fields: Record<string, string>
): Promise<ZohoCreateResult> {
  const result = await zohoFetch<{ data: ZohoCreateResult[] }>(
    ctx,
    "/Contacts",
    {
      method: "POST",
      body: JSON.stringify({ data: [fields] })
    }
  );
  const r = result.data?.[0];
  if (!r) throw new Error('ZOHO createContact: empty response');
  if (r.code !== 'SUCCESS' && r.code !== 'DUPLICATE_DATA') {
    throw new Error(`ZOHO createContact failed: ${r.code} – ${r.message}`);
  }
  return r;
}

export async function updateContact(
  ctx: ZohoContext,
  id: string,
  fields: Record<string, string>
): Promise<ZohoCreateResult> {
  const result = await zohoFetch<{ data: ZohoCreateResult[] }>(
    ctx,
    `/Contacts/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: [{ id, ...fields }] })
    }
  );
  return result.data[0];
}

export async function deleteContact(
  ctx: ZohoContext,
  id: string
): Promise<void> {
  await zohoFetch<unknown>(ctx, `/Contacts/${id}`, { method: "DELETE" });
}

export async function fetchContactsPage(
  ctx: ZohoContext,
  opts: { page?: number; perPage?: number; extraFields?: string[] }
): Promise<{ contacts: ZohoContact[]; hasMore: boolean; nextPage: number }> {
  const page = opts.page ?? 1;
  const perPage = Math.min(opts.perPage ?? 200, 200);
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage)
  });
  const result = await zohoFetch<ZohoListResponse<ZohoContact>>(
    ctx,
    `/Contacts?${params}`
  );
  return {
    contacts: result.data ?? [],
    hasMore: result.info?.more_records ?? false,
    nextPage: page + 1
  };
}

// Batch upsert up to 100 contacts, deduped by Email.
// Returns a map of Wix_Contact_Id → zoho_id.
export async function batchUpsertZohoContactsByEmail(
  ctx: ZohoContext,
  inputs: Array<{ fields: Record<string, string> }>
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    const result = await zohoFetch<{ data: ZohoCreateResult[] }>(
      ctx,
      "/Contacts/upsert",
      {
        method: "POST",
        body: JSON.stringify({
          data: chunk.map(({ fields }) => fields),
          duplicate_check_fields: ["Email"]
        })
      }
    );
    for (let j = 0; j < result.data.length; j++) {
      const r = result.data[j];
      const wixId = chunk[j]?.fields?.Wix_Contact_Id;
      if (wixId && r?.details?.id) {
        idMap.set(wixId, String(r.details.id));
      }
    }
  }
  return idMap;
}

// Batch update existing ZOHO contacts by their ZOHO ID.
// Automatically chunks at 100 per call.
export async function batchUpdateZohoContacts(
  ctx: ZohoContext,
  inputs: Array<{ zohoId: string; fields: Record<string, string> }>
): Promise<void> {
  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    await zohoFetch(ctx, "/Contacts", {
      method: "PUT",
      body: JSON.stringify({
        data: chunk.map(({ zohoId, fields }) => ({ id: zohoId, ...fields }))
      })
    });
  }
}

// ── Fields (custom properties) ────────────────────────────────────

export async function listContactFields(
  ctx: ZohoContext
): Promise<Array<{ api_name: string; field_label: string }>> {
  const result = await zohoFetch<ZohoFieldsResponse>(
    ctx,
    "/settings/fields?module=Contacts"
  );
  return result.fields ?? [];
}

export async function zohoFieldExists(
  ctx: ZohoContext,
  apiName: string
): Promise<boolean> {
  const fields = await listContactFields(ctx);
  return fields.some((f) => f.api_name === apiName);
}

export async function zohoIntegrationFieldsExist(
  ctx: ZohoContext
): Promise<boolean> {
  return zohoFieldExists(ctx, "Wix_Contact_Id");
}

// Returns true if newly created, false if already existed.
export async function ensureCustomField(
  ctx: ZohoContext,
  fieldLabel: string
): Promise<boolean> {
  const fields = await listContactFields(ctx);
  const exists = fields.some(
    (f) =>
      f.field_label === fieldLabel ||
      f.api_name === fieldLabel.replace(/ /g, "_")
  );
  if (exists) return false;

  await zohoFetch(ctx, "/settings/fields?module=Contacts", {
    method: "POST",
    body: JSON.stringify({
      fields: [{ field_label: fieldLabel, data_type: "text" }]
    })
  });
  return true;
}

export async function ensureIntegrationFields(ctx: ZohoContext): Promise<void> {
  const fields: string[] = ["Wix Contact Id", "Wix Sync Source"];
  for (const label of fields) {
    await ensureCustomField(ctx, label).catch((err) =>
      logger.warn("[zoho] ensureCustomField failed", {
        label,
        err: String(err)
      })
    );
  }
}

// ── Webhook channel ───────────────────────────────────────────────

export async function registerWebhookChannel(
  ctx: ZohoContext,
  notifyUrl: string,
  channelId: string,
  channelToken: string
): Promise<string> {
  // Zoho caps channel_expiry at 7 days; anything longer silently becomes 1 hour.
  const requestedExpiry = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "+00:00");

  const result = await zohoFetch<{
    watch: Array<{
      code?: string;
      status?: string;
      message?: string;
      details?: { events?: Array<{ channel_expiry?: string }> };
    }>;
  }>(ctx, "/actions/watch", {
    method: "POST",
    body: JSON.stringify({
      watch: [
        {
          channel_id: channelId,
          events: ["Contacts.create", "Contacts.edit", "Contacts.delete"],
          channel_expiry: requestedExpiry,
          notify_url: notifyUrl,
          token: channelToken
        }
      ]
    })
  });

  const entry = result?.watch?.[0];
  // ZOHO returns the actual expiry under details.events[0].channel_expiry
  const actualExpiry =
    entry?.details?.events?.[0]?.channel_expiry ?? requestedExpiry;
  logger.info("[zoho] registerWebhookChannel response", {
    code: entry?.code,
    status: entry?.status,
    message: entry?.message,
    events: entry?.details?.events,
    requestedExpiry,
    actualExpiry,
    notifyUrl,
    channelId
  });

  if (entry?.status === "error" || (entry?.code && entry.code !== "SUCCESS")) {
    throw new Error(
      `ZOHO channel registration failed: ${entry.code} – ${entry.message}`
    );
  }

  // Return ZOHO's actual assigned expiry — may be shorter than requested.
  return actualExpiry;
}

export async function renewWebhookChannel(
  ctx: ZohoContext,
  channelId: string
): Promise<string> {
  const requestedExpiry = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "+00:00");

  const result = await zohoFetch<{
    watch: Array<{
      code?: string;
      status?: string;
      details?: { events?: Array<{ channel_expiry?: string }> };
    }>;
  }>(ctx, "/actions/watch", {
    method: "PATCH",
    body: JSON.stringify({
      watch: [{ channel_id: channelId, channel_expiry: requestedExpiry }]
    })
  });

  const entry = result?.watch?.[0];
  return entry?.details?.events?.[0]?.channel_expiry ?? requestedExpiry;
}

export async function deleteWebhookChannel(
  ctx: ZohoContext,
  channelId: string
): Promise<void> {
  const result = await zohoFetch<{
    watch: Array<{ code?: string; status?: string; message?: string }>;
  }>(ctx, `/actions/watch?channel_ids=${channelId}`, { method: "DELETE" });

  const entry = result?.watch?.[0];
  logger.info("[zoho] deleteWebhookChannel", {
    channelId,
    code: entry?.code,
    status: entry?.status
  });
}

// ── Field extraction & building ───────────────────────────────────

// Handles dot-notation paths with array indices, e.g. "info.emails[0].email"
export function extractWixField(
  contact: Record<string, unknown>,
  path: string
): string {
  const value = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce<unknown>(
      (obj, key) =>
        obj != null && typeof obj === "object"
          ? (obj as Record<string, unknown>)[key]
          : undefined,
      contact
    );
  return typeof value === "string" ? value : "";
}

export function applyTransform(
  value: string,
  transform: FieldMapping["transform"]
): string {
  if (transform === "trim") return value.trim();
  if (transform === "lowercase") return value.toLowerCase();
  if (transform === "uppercase") return value.toUpperCase();
  return value;
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  afghanistan: "AF",
  albania: "AL",
  algeria: "DZ",
  andorra: "AD",
  angola: "AO",
  argentina: "AR",
  armenia: "AM",
  australia: "AU",
  austria: "AT",
  azerbaijan: "AZ",
  bahrain: "BH",
  bangladesh: "BD",
  belarus: "BY",
  belgium: "BE",
  bolivia: "BO",
  botswana: "BW",
  brazil: "BR",
  bulgaria: "BG",
  cambodia: "KH",
  cameroon: "CM",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  croatia: "HR",
  cuba: "CU",
  cyprus: "CY",
  czechia: "CZ",
  "czech republic": "CZ",
  denmark: "DK",
  ecuador: "EC",
  egypt: "EG",
  ethiopia: "ET",
  finland: "FI",
  france: "FR",
  georgia: "GE",
  germany: "DE",
  ghana: "GH",
  greece: "GR",
  guatemala: "GT",
  honduras: "HN",
  hungary: "HU",
  india: "IN",
  indonesia: "ID",
  iran: "IR",
  iraq: "IQ",
  ireland: "IE",
  israel: "IL",
  italy: "IT",
  jamaica: "JM",
  japan: "JP",
  jordan: "JO",
  kazakhstan: "KZ",
  kenya: "KE",
  kuwait: "KW",
  latvia: "LV",
  lebanon: "LB",
  libya: "LY",
  lithuania: "LT",
  luxembourg: "LU",
  malaysia: "MY",
  malta: "MT",
  mexico: "MX",
  moldova: "MD",
  morocco: "MA",
  mozambique: "MZ",
  namibia: "NA",
  netherlands: "NL",
  "new zealand": "NZ",
  nigeria: "NG",
  norway: "NO",
  oman: "OM",
  pakistan: "PK",
  panama: "PA",
  paraguay: "PY",
  peru: "PE",
  philippines: "PH",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  "russian federation": "RU",
  "saudi arabia": "SA",
  senegal: "SN",
  serbia: "RS",
  singapore: "SG",
  slovakia: "SK",
  slovenia: "SI",
  somalia: "SO",
  "south africa": "ZA",
  "south korea": "KR",
  spain: "ES",
  "sri lanka": "LK",
  sudan: "SD",
  sweden: "SE",
  switzerland: "CH",
  syria: "SY",
  taiwan: "TW",
  tanzania: "TZ",
  thailand: "TH",
  tunisia: "TN",
  turkey: "TR",
  uganda: "UG",
  ukraine: "UA",
  "united arab emirates": "AE",
  uae: "AE",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  uruguay: "UY",
  uzbekistan: "UZ",
  venezuela: "VE",
  vietnam: "VN",
  yemen: "YE",
  zambia: "ZM",
  zimbabwe: "ZW"
};

export function countryToIso2(name: string): string {
  if (!name) return "";
  if (/^[A-Za-z]{2}$/.test(name)) return name.toUpperCase();
  return COUNTRY_NAME_TO_ISO[name.toLowerCase()] ?? name;
}

export function buildZohoFields(
  wixContact: Record<string, unknown>,
  mappings: FieldMapping[],
  syncTs: number
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const m of mappings) {
    if (m.direction === "zoho_to_wix") continue;
    const raw = extractWixField(wixContact, m.wixField);
    if (!raw) continue;
    let value = applyTransform(raw, m.transform);
    if (m.wixField.includes("country")) value = countryToIso2(value);
    fields[m.zohoProp] = value;
  }

  fields["Wix_Sync_Source"] = `wix_sync_${syncTs}`;
  return fields;
}

export function isOwnWrite(wixSyncSource: string | undefined): boolean {
  if (!wixSyncSource?.startsWith("wix_sync_")) return false;
  const ts = parseInt(wixSyncSource.replace("wix_sync_", ""), 10);
  return Date.now() - ts < 5 * 60 * 1000;
}
