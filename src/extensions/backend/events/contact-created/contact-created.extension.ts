import { extensions } from '@wix/astro/builders';

export const eventContactCreated = extensions.event({
  id: 'ffb37326-f2f1-417f-a8f8-81e403efe7b4',
  source: './extensions/backend/events/contact-created/contact-created.ts',
});
