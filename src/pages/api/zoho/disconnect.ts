import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { getToken, deleteToken } from '../../../backend/_shared/db.ts';
import { createZohoContext, deleteWebhookChannel } from '../../../backend/zoho-client.ts';
import { logger } from '../../../backend/logger.ts';

export const POST: APIRoute = async () => {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo?.instanceId;
  if (!instanceId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  logger.info('[disconnect] disconnecting', { instanceId });

  const token = await getToken(instanceId);
  if (token?.channel_id) {
    try {
      const ctx = await createZohoContext(instanceId);
      await deleteWebhookChannel(ctx, token.channel_id);
      logger.info('[disconnect] webhook channel deleted', { instanceId, channelId: token.channel_id });
    } catch (err) {
      logger.warn('[disconnect] failed to delete webhook channel — proceeding with disconnect', {
        instanceId,
        channelId: token.channel_id,
        err: String(err),
      });
    }
  }

  await deleteToken(instanceId);
  logger.info('[disconnect] token deleted — disconnect complete', { instanceId });

  return Response.json({ success: true });
};
