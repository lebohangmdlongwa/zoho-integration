import { contacts } from '@wix/crm';
import { syncContactToZoho, buildWixContactFromEntity } from '../../../../backend/wix-contact-sync.ts';
import { logger } from '../../../../backend/logger.ts';

const OUR_APP_ID = 'e24ccf8c-8cd5-4e03-b1bc-00a93a4b265d';

export default contacts.onContactCreated(async (event) => {
  const instanceId = event.metadata?.instanceId ?? '';
  const contact = (event as any).entity ?? (event as any).data?.contact ?? {};
  const contactId = contact._id ?? contact.id ?? '';

  logger.info('[contact-created] event received', { instanceId, contactId });

  if (!instanceId || !contactId) {
    logger.warn('[contact-created] missing instanceId or contactId', { instanceId, contactId });
    return;
  }

  const sourceAppId: string = contact.source?.wixAppId ?? '';
  if (sourceAppId === OUR_APP_ID) {
    logger.info('[contact-created] skip: created by our app', { contactId });
    return;
  }

  try {
    await syncContactToZoho(instanceId, contactId, buildWixContactFromEntity(contact));
  } catch (err) {
    logger.error('[contact-created] unhandled error', { contactId, err: String(err) });
  }
});
