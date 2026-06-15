import { contacts } from '@wix/crm';
import { syncContactToZoho, buildWixContactFromEntity } from '../../../../backend/wix-contact-sync.ts';
import { logger } from '../../../../backend/logger.ts';

export default contacts.onContactUpdated(async (event) => {
  const instanceId = event.metadata?.instanceId ?? '';
  const contact = (event as any).entity ?? (event as any).data?.contact ?? {};
  const contactId = contact._id ?? contact.id ?? '';

  logger.info('[contact-updated] event received', { instanceId, contactId });

  if (!instanceId || !contactId) {
    logger.warn('[contact-updated] missing instanceId or contactId', { instanceId, contactId });
    return;
  }

  try {
    await syncContactToZoho(instanceId, contactId, buildWixContactFromEntity(contact));
  } catch (err) {
    logger.error('[contact-updated] unhandled error', { contactId, err: String(err) });
  }
});
