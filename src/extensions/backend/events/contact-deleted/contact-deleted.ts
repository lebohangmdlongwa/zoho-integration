import { contacts } from '@wix/crm';
import { getIdMapByWixId, deleteIdMapByWixId, insertSyncLog } from '../../../../backend/_shared/db.ts';
import { createZohoContext, deleteContact } from '../../../../backend/zoho-client.ts';
import { logger } from '../../../../backend/logger.ts';

export default contacts.onContactDeleted(async (event) => {
  const instanceId = event.metadata?.instanceId ?? '';
  const contactId = event.metadata?.entityId ?? '';

  logger.info('[contact-deleted] event received', { instanceId, contactId });

  if (!instanceId || !contactId) {
    logger.warn('[contact-deleted] missing instanceId or contactId', { instanceId, contactId });
    return;
  }

  try {
    const idMap = await getIdMapByWixId(instanceId, contactId);

    if (idMap?.zoho_id) {
      const ctx = await createZohoContext(instanceId);
      await deleteContact(ctx, idMap.zoho_id);
      logger.info('[contact-deleted] deleted zoho contact', { instanceId, contactId, zohoId: idMap.zoho_id });
    } else {
      logger.info('[contact-deleted] no linked zoho contact', { instanceId, contactId });
    }

    await deleteIdMapByWixId(instanceId, contactId);

    await insertSyncLog({
      instance_id: instanceId,
      direction: 'wix_to_zoho',
      entity_type: 'contact',
      wix_id: contactId,
      zoho_id: idMap?.zoho_id ?? null,
      status: idMap?.zoho_id ? 'success' : 'skipped',
      skip_reason: idMap?.zoho_id ? null : 'no_linked_zoho_contact',
      error_message: null,
      sync_id: 'contact-deleted',
    });
  } catch (err) {
    logger.error('[contact-deleted] failed', { contactId, instanceId, err: String(err) });
  }
});
