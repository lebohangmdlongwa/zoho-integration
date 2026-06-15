import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';

export const GET: APIRoute = async ({ url }) => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId ?? 'unknown';

  const redirectUri =
    (import.meta.env.ZOHO_REDIRECT_URI ?? process.env.ZOHO_REDIRECT_URI) ??
    `${url.origin}/api/zoho/callback`;

  const params = new URLSearchParams({
    client_id: (import.meta.env.ZOHO_CLIENT_ID ?? process.env.ZOHO_CLIENT_ID)!,
    redirect_uri: redirectUri,
    scope: [
      'ZohoCRM.modules.contacts.ALL',
      'ZohoCRM.modules.leads.ALL',
      'ZohoCRM.settings.fields.ALL',
      'ZohoCRM.users.ALL',
      'ZohoCRM.org.ALL',
      'ZohoCRM.notifications.ALL',
      'offline_access',
    ].join(' '),
    response_type: 'code',
    state: instanceId,
    access_type: 'offline',
  });

  return Response.json({
    authUrl: `https://accounts.zoho.com/oauth/v2/auth?${params}`,
  });
};
