import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';
import { customJson } from '../../utils/customJson';
import { FREE_CONTACT_LIMIT, PLAN_LIMITS } from '../../backend/_shared/plan-limits';

const APP_ID = '70904893-2772-4283-b3d8-9a369ebf5823';
const FALLBACK_UPGRADE_URL = `https://manage.wix.com/app-pricing-plans/${APP_ID}/plan`;

export const GET: APIRoute = () => {
  const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
  return elevatedGetAppInstance()
    .then((res) => {
      const { instance, site } = res as any;
      const metaSiteId: string | undefined = site?.siteId;

      console.log('[check-plan] instance:', {
        isFree: instance?.isFree,
        packageName: instance?.billing?.packageName,
        billingCycle: instance?.billing?.billingCycle,
        instanceId: instance?.instanceId,
        metaSiteId,
      });

      const isPremium = instance ? !instance.isFree : false;
      const packageName = (instance?.billing?.packageName ?? '').toLowerCase();
      const instanceId = instance?.instanceId;
      const rawLimit = isPremium
        ? (PLAN_LIMITS[packageName] ?? FREE_CONTACT_LIMIT)
        : FREE_CONTACT_LIMIT;
      const contactLimit = isFinite(rawLimit) ? rawLimit : null;

      let upgradeUrl: string | undefined;
      if (!isPremium) {
        if (instanceId && metaSiteId) {
          upgradeUrl = `https://manage.wix.com/app-pricing-plans/${APP_ID}/plan?app-instance-id=${instanceId}&meta-site-id=${metaSiteId}`;
        } else if (instanceId) {
          upgradeUrl = `https://www.wix.com/apps/upgrade/${APP_ID}?appInstanceId=${instanceId}`;
        } else {
          upgradeUrl = FALLBACK_UPGRADE_URL;
        }
      }

      console.log('[check-plan] response:', { isPremium, packageName, contactLimit, upgradeUrl });
      return customJson({ isPremium, packageName, contactLimit, upgradeUrl });
    })
    .catch((err) => {
      console.error('[check-plan] failed:', err);
      return customJson({ isPremium: false, packageName: '', contactLimit: FREE_CONTACT_LIMIT, upgradeUrl: FALLBACK_UPGRADE_URL });
    });
};
