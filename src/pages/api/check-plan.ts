import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';
import { customJson } from '../../utils/customJson';
import { FREE_CONTACT_LIMIT, PLAN_LIMITS } from '../../backend/_shared/plan-limits';

const APP_ID = '1742b6a3-e4ad-4381-a2bc-961133180800';
const FALLBACK_UPGRADE_URL = `https://www.wix.com/apps/upgrade/${APP_ID}`;

export const GET: APIRoute = () => {
  const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
  return elevatedGetAppInstance()
    .then(({ instance }) => {
      const isPremium = instance ? !instance.isFree : false;
      const packageName = (instance?.billing?.packageName ?? '').toLowerCase();
      const instanceId = (instance as any)?.instanceId;
      const rawLimit = isPremium
        ? (PLAN_LIMITS[packageName] ?? FREE_CONTACT_LIMIT)
        : FREE_CONTACT_LIMIT;
      const contactLimit = isFinite(rawLimit) ? rawLimit : null;
      const upgradeUrl = !isPremium
        ? instanceId
          ? `https://www.wix.com/apps/upgrade/${APP_ID}?appInstanceId=${instanceId}`
          : FALLBACK_UPGRADE_URL
        : undefined;
      return customJson({ isPremium, packageName, contactLimit, upgradeUrl });
    })
    .catch(() =>
      customJson({ isPremium: false, packageName: '', contactLimit: FREE_CONTACT_LIMIT, upgradeUrl: FALLBACK_UPGRADE_URL }),
    );
};
