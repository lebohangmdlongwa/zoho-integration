import type { APIRoute } from 'astro';
import { createZohoContext, searchContactByEmail, createContact, ensureIntegrationFields } from '../../../backend/zoho-client.ts';

// Per-process cache: avoid re-checking Zoho custom fields on every form submission.
const ensuredInstances = new Set<string>();

const FIELD_MAP: Record<string, string> = {
  firstname: 'First_Name',
  lastname: 'Last_Name',
  email: 'Email',
  phone: 'Phone',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export const POST: APIRoute = async ({ request }) => {
  let body: { instanceId?: string; fields?: { label: string; value: string }[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { instanceId, fields } = body;
  if (!instanceId || !fields?.length) {
    return json({ error: 'Missing instanceId or fields' }, 400);
  }

  let ctx: Awaited<ReturnType<typeof createZohoContext>>;
  try {
    ctx = await createZohoContext(instanceId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not connected') || msg.includes('api_domain missing')) {
      return json({ error: 'Zoho CRM is not connected. Please complete setup in the dashboard.' }, 403);
    }
    console.error('[form-submit] createZohoContext failed', err);
    return json({ error: 'Could not connect to Zoho CRM. Please try again.' }, 500);
  }

  const zohoFields: Record<string, string> = { Wix_Sync_Source: 'wix_form' };
  for (const { label, value } of fields) {
    const mapped = FIELD_MAP[label.toLowerCase()];
    if (mapped && value) zohoFields[mapped] = value;
  }

  // Zoho requires Last_Name on create — fall back to first name or email local part
  if (!zohoFields.Last_Name) {
    if (zohoFields.First_Name) {
      zohoFields.Last_Name = zohoFields.First_Name;
      delete zohoFields.First_Name;
    } else if (zohoFields.Email) {
      zohoFields.Last_Name = zohoFields.Email.split('@')[0];
    } else {
      return json({ error: 'Please provide at least a name or email address.' }, 400);
    }
  }

  if (!zohoFields.Email && !zohoFields.Last_Name) {
    return json({ error: 'Email or last name is required' }, 400);
  }

  // Ensure Wix_Contact_Id and Wix_Sync_Source custom fields exist in Zoho.
  // This is normally done at connect time but may have failed silently.
  if (!ensuredInstances.has(instanceId)) {
    try {
      await ensureIntegrationFields(ctx);
      ensuredInstances.add(instanceId);
    } catch (err) {
      console.warn('[form-submit] ensureIntegrationFields failed (non-fatal)', err);
      ensuredInstances.add(instanceId); // Don't retry on every request
    }
  }

  try {
    if (zohoFields.Email) {
      const existing = await searchContactByEmail(ctx, zohoFields.Email);
      if (existing) {
        return json({ success: true });
      }
    }
    await createContact(ctx, zohoFields);
    return json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[form-submit] Zoho API error', detail);
    return json({ error: `Failed to create contact: ${detail}` }, 500);
  }
};

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
