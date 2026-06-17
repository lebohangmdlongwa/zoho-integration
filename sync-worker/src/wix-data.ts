// Shared constants and pure data-mapping helpers for the Deals sync.
// Imported by deals-sync.ts and deals-webhook.ts.

export const DEALS_PAGE_SIZE = 200;
export const DEALS_FIELDS = [
	'Deal_Name', 'Amount', 'Stage', 'Closing_Date', 'Probability',
	'Expected_Revenue', 'Type', 'Next_Step', 'Lead_Source', 'Description', 'Contact_Name',
].join(',');

// Maps a Zoho Deal record to snake_case column names for the Supabase 'deals' table.
// Contact_Name is a lookup field — Zoho returns { name, id }.
// Closing_Date arrives as "YYYY-MM-DD" — stored as-is (Postgres DATE column).
export function buildSupabaseDealRow(deal: Record<string, unknown>, instanceId: string): Record<string, unknown> {
	const lookupStr = (v: unknown, key: 'name' | 'id'): string | null => {
		if (!v || typeof v !== 'object') return null;
		return (v as Record<string, string>)[key] ?? null;
	};

	const row: Record<string, unknown> = {
		instance_id: instanceId,
		zoho_deal_id: String(deal['id']),
		updated_at: new Date().toISOString(),
	};

	if (deal['Deal_Name']) row.deal_name = String(deal['Deal_Name']);
	if (deal['Stage']) row.stage = String(deal['Stage']);
	if (deal['Amount'] != null) row.amount = Number(deal['Amount']);
	if (deal['Closing_Date']) row.closing_date = String(deal['Closing_Date']);
	if (deal['Probability'] != null) row.probability = Number(deal['Probability']);
	if (deal['Expected_Revenue'] != null) row.expected_revenue = Number(deal['Expected_Revenue']);
	if (deal['Type']) row.deal_type = String(deal['Type']);
	if (deal['Next_Step']) row.next_step = String(deal['Next_Step']);
	if (deal['Lead_Source']) row.lead_source = String(deal['Lead_Source']);
	if (deal['Description']) row.description = String(deal['Description']);

	const contactName = lookupStr(deal['Contact_Name'], 'name');
	if (contactName) row.contact_name = contactName;
	const contactZohoId = lookupStr(deal['Contact_Name'], 'id');
	if (contactZohoId) row.zoho_contact_id = contactZohoId;

	return row;
}
