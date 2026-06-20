import type { MiddlewareHandler } from 'astro';
import { handleZohoWebhook } from './pages/api/zoho/webhook.ts';
import { handleZohoCallback } from './backend/zoho-callback-handler.ts';
import {
  POST as handleFormSubmit,
  OPTIONS as handleFormOptions,
} from './pages/api/zoho/form-submit.ts';

const FORM_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Registered with order:'pre' so it runs before @wix/astro's pre-middleware,
// which rejects external requests that have no Wix session cookie.
export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;
  const method = context.request.method;

  if (pathname === '/api/zoho/webhook' && method === 'POST') {
    try {
      return await handleZohoWebhook(context.request);
    } catch (err) {
      console.error('[webhook-bypass] unhandled error:', err);
      return new Response(String(err), { status: 500 });
    }
  }

  if (pathname === '/api/zoho/callback' && method === 'GET') {
    try {
      return await handleZohoCallback(context.request);
    } catch (err) {
      console.error('[webhook-bypass] callback error:', err);
      return new Response('OAuth callback failed', { status: 500 });
    }
  }

  // /api/zoho/form-submit is called from a public Wix page widget — no Wix session.
  if (pathname === '/api/zoho/form-submit') {
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: FORM_CORS });
    }
    if (method === 'POST') {
      try {
        return await handleFormSubmit({ request: context.request } as any);
      } catch (err) {
        console.error('[webhook-bypass] form-submit error:', err);
        return new Response(
          JSON.stringify({ error: String(err) }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
        );
      }
    }
  }

  return next();
};
