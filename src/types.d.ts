type StoredToken = {
  instance_id: string;
  site_id?: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
  org_id: string | null;         // ZOHO Organization ID (ZSOID)
  api_domain: string | null;     // e.g. "https://www.zohoapis.com"
  dc: string | null;             // "com" | "eu" | "in" | "com.au" | "jp" | "zohocloud.ca"
  channel_id: string | null;     // 13-digit webhook channel ID
  channel_expiry: string | null; // ISO timestamp — renew before this date
  connected_at: number;          // Unix ms
};

type ZohoContact = {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Email?: string;
  Phone?: string;
  Account_Name?: string;  // company name on Contacts module
  Company?: string;       // company name on Leads module
  Title?: string;         // job title
  Wix_Contact_Id?: string;
  Wix_Sync_Source?: string;
  Modified_Time?: string;
  [key: string]: string | undefined;
};

type ZohoTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  api_domain: string; // e.g. "https://www.zohoapis.com"
};

type ZohoCreateResult = {
  code: 'SUCCESS' | 'DUPLICATE_DATA' | string;
  details: { id: string; [key: string]: unknown };
  message: string;
  status: string;
};

type IdMapRow = {
  instance_id: string;
  wix_id: string;
  zoho_id: string;
  entity_type: 'contact';
  last_sync_source: 'wix' | 'zoho' | null;
  last_sync_id: string | null;
  last_synced_at: string;
};

type SyncLogRow = {
  id: string;
  instance_id: string;
  direction: 'wix_to_zoho' | 'zoho_to_wix' | 'form_submit';
  entity_type: 'contact';
  wix_id: string | null;
  zoho_id: string | null;
  status: 'success' | 'error' | 'skipped';
  skip_reason: string | null;
  error_message: string | null;
  sync_id: string | null;
  synced_at: string;
};

type FieldMapping = {
  wixField: string;
  zohoProp: string;
  direction: 'wix_to_zoho' | 'zoho_to_wix' | 'bidirectional';
  transform: 'none' | 'trim' | 'lowercase' | 'uppercase';
};

type SyncStatus = {
  connected: boolean;
  orgId: string | null;
  connectedAt: number | null;
  contactsSynced: number;
  formSubmissions: number;
  lastSyncAt: string | null;
  channelId: string | null;
};

// ── Billing / plan pricing types (used by PlansPage and my-page) ─────────────

interface AppPlan {
  _id: string;
  name: string;
  benefits: string[];
  prices: Array<{
    billingCycle: {
      cycleType?: string;
      cycleDuration?: { unit: 'MONTH' | 'YEAR' | string; count?: number };
    };
    priceBeforeTax?: string;
    totalPrice?: string;
  }>;
}

interface PlanPricing {
  plans: AppPlan[];
  currency: string;
  showPriceWithTax: boolean;
}

interface PricingTier {
  name: string;
  planId?: string;
  monthlyPrice?: string;
  yearlyPrice?: string;
  savingsPercent?: number;
  features: string[];
  popular?: boolean;
}

// ── Node built-ins (available until @types/node is installed) ─────────────────

declare var process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
  export function pathToFileURL(path: string): URL;
}

declare module 'node:crypto' {
  export function createHmac(algorithm: string, key: string | Buffer): {
    update(data: string): { digest(encoding: string): string };
  };
  export function timingSafeEqual(a: Buffer | Uint8Array, b: Buffer | Uint8Array): boolean;
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: string): string };
  };
  export function randomUUID(): string;
}

// ── Ambient declarations for Wix packages that may not yet be installed ──────

declare module '@wix/crm' {
  type ContactEventMetadata = {
    instanceId?: string;
    entityId?: string;
    eventTime?: string;
  };
  type ContactEvent = {
    metadata?: ContactEventMetadata;
    entity?: Record<string, unknown>;
    data?: { contact?: Record<string, unknown> };
  };
  type EventHandler = (event: ContactEvent) => Promise<void> | void;
  export const contacts: {
    onContactCreated(handler: EventHandler): unknown;
    onContactUpdated(handler: EventHandler): unknown;
    onContactDeleted(handler: EventHandler): unknown;
  };
}

declare module '@wix/app-management' {
  export const appPlans: {
    listAppPlansByAppId(appIds: string[]): Promise<{
      appPlans?: Array<{ plans?: AppPlan[] }>;
      currency?: string;
      taxSettings?: { showPriceWithTax?: boolean };
    }>;
  };
  export const appInstances: {
    getAppInstance(): Promise<{
      instance?: {
        billing?: { packageName?: string; billingCycle?: string };
        isFree?: boolean;
        paymentStatus?: string;
      };
      site?: { siteDisplayName?: string };
    }>;
  };
}

declare module '@supabase/supabase-js' {
  export interface SupabaseClientOptions {
    auth?: Record<string, unknown>;
    global?: { fetch?: typeof fetch };
    realtime?: Record<string, unknown>;
    db?: { schema?: string };
  }
  export function createClient(url: string, key: string, options?: SupabaseClientOptions): SupabaseClient;
  export interface SupabaseClient {
    from(table: string): SupabaseQueryBuilder;
    rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: SupabaseError | null }>;
  }
  export interface SupabaseQueryBuilder {
    select(columns?: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): SupabaseFilterBuilder;
    insert(data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): SupabaseFilterBuilder;
    update(data: Record<string, unknown>): SupabaseFilterBuilder;
    upsert(data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }): SupabaseFilterBuilder;
    delete(): SupabaseFilterBuilder;
  }
  export interface SupabaseFilterBuilder {
    eq(column: string, value: unknown): SupabaseFilterBuilder;
    neq(column: string, value: unknown): SupabaseFilterBuilder;
    not(column: string, operator: string, value: unknown): SupabaseFilterBuilder;
    in(column: string, values: unknown[]): SupabaseFilterBuilder;
    is(column: string, value: unknown): SupabaseFilterBuilder;
    lt(column: string, value: unknown): SupabaseFilterBuilder;
    lte(column: string, value: unknown): SupabaseFilterBuilder;
    select(columns?: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): SupabaseFilterBuilder;
    order(column: string, opts?: { ascending?: boolean }): SupabaseFilterBuilder;
    limit(count: number): SupabaseFilterBuilder;
    single(): Promise<{ data: any; error: SupabaseError | null }>;
    maybeSingle(): Promise<{ data: any; error: SupabaseError | null }>;
    then<T>(resolve: (value: { data: any; error: SupabaseError | null; count?: number | null }) => T): Promise<T>;
  }
  export interface SupabaseError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  }
}

// ── Ambient module declaration — @wix/contacts ships an empty index.d.ts ─────
declare module '@wix/contacts' {
  export const contacts: {
    getContact(
      id: string,
      opts?: Record<string, unknown>,
    ): Promise<{
      id: string;
      revision: number | null;
      info: {
        name?: { first?: string; last?: string };
        emails?:
          | { items?: Array<{ email: string; tag?: string }> }
          | Array<{ email: string; tag?: string }>;
        phones?:
          | { items?: Array<{ phone: string; tag?: string }> }
          | Array<{ phone: string; tag?: string }>;
        company?: { name?: string };
        jobTitle?: string;
        addresses?: Array<{
          city?: string;
          country?: string;
          postalCode?: string;
        }>;
      };
      [key: string]: unknown;
    }>;
    listContacts(opts?: {
      cursorPaging?: { cursor?: string; limit?: number };
      [key: string]: unknown;
    }): Promise<{
      contacts?: Array<Record<string, unknown>>;
      pagingMetadata?: { cursors?: { next?: string } };
    }>;
    updateContact(
      id: string,
      revision: number | null,
      opts: { info: Record<string, unknown> },
    ): Promise<{ contact?: Record<string, unknown> }>;
    createContact(
      info: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ): Promise<{ id: string; [key: string]: unknown }>;
  };
}
