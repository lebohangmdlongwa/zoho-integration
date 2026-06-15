@AGENTS.md

---

## Reference Files — Read Before Adding Anything

### 1. Variable definitions — `sync-worker/VARIABLES.md`

**Read this before touching `sync-worker/src/index.ts` in any way.**
It documents every runtime variable in the sync worker (`wixIdByZohoId`, `zohoIdByWixId`, `wixRevisionMap`, `preStampWixIds`, `newContactStamps`, `dedupedIdMapBatch`, `syncRunId`, `syncSourceStamp`, `wixTokenCache`, and all others), explains what each one holds, why it exists, and which variables must be set before the worker runs (Cloudflare secrets, ZOHO CRM custom fields, Supabase columns).

If you are adding a new variable, check this file first — it may already exist under a different name or be derivable from an existing one.

File: `sync-worker/VARIABLES.md`

---

### 2. ZOHO API Official Reference — Scopes and Webhook Notifications

When you need to look up ZOHO CRM OAuth scope strings or webhook notification API details, fetch these two pages directly — do not guess scope strings from memory:

- **All CRM scopes:** https://www.zoho.com/crm/developer/docs/api/v8/scopes.html
  Scope strings follow the pattern `ZohoCRM.<module>.<operation>` (e.g. `ZohoCRM.modules.contacts.ALL`). Always fetch this page and copy the literal strings — never invent or paraphrase them.

- **Enable webhook notifications (channel registration):** https://www.zoho.com/crm/developer/docs/api/v8/notifications/enable.html
  Documents the required scopes for the webhook/notification channel API, the request format, and the channel model. Fetch this page before writing any webhook registration code.

---

### 3. ZOHO vs HubSpot API differences — `ZOHO_IMPLEMENTATION/zoho-api-diff.md`

**Read this before writing any ZOHO API call, OAuth flow, webhook handler, or field mapping.**
It is the authoritative diff between the HubSpot and ZOHO APIs for this project. Everything in it was deliberately decided — do not deviate from it.

Key things documented:
- DC-specific OAuth URLs and why `api_domain` must be stored (not hardcoded to `.com`)
- ZOHO org ID lookup (`/crm/v2/org`) vs HubSpot's `portalId`
- ZOHO API base URL format (`{api_domain}/crm/v2/Contacts`) vs HubSpot's
- ZOHO pagination (`?page=N&per_page=200`, `info.more_records`) vs HubSpot cursor-based
- ZOHO upsert response format (`data[n].code`, `details.id`) vs HubSpot
- ZOHO webhook channel model vs HubSpot subscription model
- ZOHO custom field names (`Wix_Contact_Id`, `Wix_Sync_Source`) vs HubSpot equivalents
- Supabase schema column renames (`zoho_id`, `org_id`, `api_domain`, `dc`, `channel_id`)

File: `ZOHO_IMPLEMENTATION/zoho-api-diff.md`

---

### 3. The HubSpot integration project — source of truth for all patterns

**Before implementing any new feature in this project, check if it already exists in the HubSpot integration.** The rule is: *everything except the CRM API calls themselves is directly reusable from HubSpot* — the Wix side, Supabase schema, sync logic, dedup layers, dashboard UI, and worker architecture are all shared patterns. Do not reinvent; port.

HubSpot project root: `/Users/learnndlovu/Desktop/wix-hubspot-integration/`

The most important files to read when porting a feature:

| What you are building | Read this HubSpot file first |
|---|---|
| Sync worker logic (Phase 1, Phase 2, cron, queue consumer) | `hubspot-webhook-worker/src/index.ts` |
| OAuth initiate / callback flow | `src/pages/api/hubspot/oauth-initiate.ts` · `src/pages/api/hubspot/callback.ts` · `src/pages/api/hubspot/exchange-token.ts` |
| Webhook handler (real-time CRM → Wix) | `src/pages/api/hubspot/webhook.ts` |
| Disconnect / revoke flow | `src/pages/api/hubspot/disconnect.ts` |
| Sync status API (job progress, logs) | `src/pages/api/hubspot/status.ts` |
| Field mapping CRUD API | `src/pages/api/hubspot/field-mapping.ts` |
| Ensure custom CRM fields exist | `src/pages/api/hubspot/ensure-fields.ts` |
| Supabase client and table helpers | `src/backend/_shared/db.ts` |
| Wix contact event handler (bounce guard) | `src/backend/events/wix-contact-sync.ts` |
| Dashboard UI — connection page | `src/extensions/dashboard/pages/my-page/` |
| Component styles | `src/extensions/dashboard/pages/my-page/styles/` |

When you find the equivalent HubSpot implementation, adapt it for ZOHO using the diff in `ZOHO_IMPLEMENTATION/zoho-api-diff.md`. Change only what the diff requires — do not change structure, naming conventions, or error handling patterns unless the diff explicitly says to.

---

## Deployment

**Never deploy anything.** The user deploys manually. Do not run `wix release`, `npx wrangler deploy`, `npm run deploy`, or any other deploy/release command.

---

## Coding Rules

- Styles for React components must live in a separate `styles/ComponentName.ts` file. Never write styles inline in the component file.
- No UTM fields. The only custom fields on the ZOHO side are `Wix_Contact_Id` and `Wix_Sync_Source`.
- The sync worker architecture must match HubSpot's exactly: Cloudflare Worker + Cloudflare Queue, tick-based (one queue message = one page), stall-recovery cron every minute.
