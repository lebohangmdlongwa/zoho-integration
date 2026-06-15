import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import {
  getToken,
  countSyncLog,
  countSyncedContacts,
  getSyncLog,
} from '../../../backend/_shared/db.ts';

export const GET: APIRoute = async () => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const token = await getToken(instanceId);

  if (!token) {
    const status: SyncStatus = {
      connected: false,
      orgId: null,
      connectedAt: null,
      contactsSynced: 0,
      formSubmissions: 0,
      lastSyncAt: null,
      channelId: null,
    };
    return Response.json({ ...status, instanceId });
  }

  const [contactsSynced, formSubmissions, log] = await Promise.all([
    countSyncedContacts(instanceId),
    countSyncLog(instanceId, { direction: 'form_submit', status: 'success' }),
    getSyncLog(instanceId, 1),
  ]);

  const status: SyncStatus = {
    connected: true,
    orgId: token.org_id,
    connectedAt: token.connected_at,
    contactsSynced,
    formSubmissions,
    lastSyncAt: log[0]?.synced_at ?? null,
    channelId: token.channel_id ?? null,
  };

  return Response.json({ ...status, instanceId, channelId: token.channel_id ?? null });
};
