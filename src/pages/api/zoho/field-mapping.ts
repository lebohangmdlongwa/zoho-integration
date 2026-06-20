import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getFieldMappings, saveFieldMappings } from '../../../backend/_shared/db.ts';

const DEFAULT_MAPPINGS: FieldMapping[] = [
  { wixField: 'info.name.first',      zohoProp: 'First_Name',   direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.name.last',       zohoProp: 'Last_Name',    direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.emails[0].email', zohoProp: 'Email',        direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.phones[0].phone', zohoProp: 'Phone',        direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.company.name',    zohoProp: 'Account_Name', direction: 'bidirectional', transform: 'none' },
  { wixField: 'info.jobTitle',        zohoProp: 'Title',        direction: 'bidirectional', transform: 'none' },
];

export const GET: APIRoute = async () => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const mappings = await getFieldMappings(instanceId);
  return Response.json({ mappings: mappings.length ? mappings : DEFAULT_MAPPINGS });
};

export const POST: APIRoute = async ({ request }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { mappings } = (await request.json()) as { mappings: FieldMapping[] };
  if (!mappings) return Response.json({ error: 'Missing mappings' }, { status: 400 });

  await saveFieldMappings(instanceId, mappings);
  return Response.json({ success: true });
};
