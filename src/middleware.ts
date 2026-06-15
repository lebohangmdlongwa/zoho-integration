import { defineMiddleware } from 'astro/middleware';

// The ZOHO OAuth callback is handled in webhook-bypass.ts (order:'pre') so it
// runs before @wix/astro's auth middleware. Nothing left to do here.
export const onRequest = defineMiddleware(async (_context, next) => next());
