import { extensions } from '@wix/astro/builders';

export const eventContactDeleted = extensions.event({
  id: 'a3f1c2d4-7e8b-4a5f-9c0d-2b6e3f1a8d7c',
  source: './extensions/backend/events/contact-deleted/contact-deleted.ts',
});
