import type { MiddlewareHandler } from 'astro';
import { handleZohoWebhook } from './pages/api/zoho/webhook.ts';
import { handleZohoCallback } from './backend/zoho-callback-handler.ts';

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

  return next();
};
