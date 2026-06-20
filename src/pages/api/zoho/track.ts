import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { insertClickEvent } from '../../../backend/_shared/db';

export const POST: APIRoute = async ({ request }) => {
  let instanceId = 'unknown';
  try {
    const tokenInfo = await auth.getTokenInfo();
    instanceId = tokenInfo?.instanceId ?? 'unknown';
  } catch (err) {
    console.warn('[track] auth.getTokenInfo failed, using unknown', err);
  }

  let body: { event_name?: unknown; properties?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const { event_name, properties } = body;

  if (!event_name || typeof event_name !== 'string') {
    console.warn('[track] missing event_name', { instanceId, body });
    return new Response(JSON.stringify({ error: 'event_name required' }), { status: 400 });
  }

  console.log('[track] received', { instanceId, event_name, properties });

  await insertClickEvent(
    instanceId,
    event_name,
    properties && typeof properties === 'object' ? (properties as Record<string, unknown>) : undefined,
  );

  console.log('[track] saved', event_name);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
