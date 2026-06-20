import { app } from '@wix/astro/builders';
import myPage from './extensions/dashboard/pages/my-page/my-page.extension.ts';
import { eventContactCreated } from './extensions/backend/events/contact-created/contact-created.extension.ts';
import { eventContactUpdated } from './extensions/backend/events/contact-updated/contact-updated.extension.ts';
import { eventContactDeleted } from './extensions/backend/events/contact-deleted/contact-deleted.extension.ts';
import zohoForm from './site/widgets/custom-elements/zoho-form/zoho-form.extension.ts';
import appInstall from './extensions/backend/events/app-install/app-install.extension.ts';
import appRemove from './extensions/backend/events/app-remove/app-remove.extension.ts';
import planChange from './extensions/backend/events/plan-change/plan-change.extension.ts';
import planPurchase from './extensions/backend/events/plan-purchase/plan-purchase.extension.ts';
// app-install, app-remove, plan-change, plan-purchased extension registrations
// must be generated via `wix extension create` — add them here once created.

export default app()
  .use(myPage)
  .use(eventContactCreated)
  .use(eventContactUpdated)
  .use(eventContactDeleted).use(zohoForm).use(appInstall).use(appRemove).use(planChange).use(planPurchase);
