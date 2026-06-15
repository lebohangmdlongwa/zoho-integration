import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';

export const FREE_CONTACT_LIMIT = 100;

export const PLAN_LIMITS: Record<string, number> = {
  light: 1_000,
  core: 10_000,
  pro: Infinity,
};

export async function getContactLimit(): Promise<number> {
  try {
    const { instance } = await auth.elevate(appInstances.getAppInstance)();
    if (instance?.isFree) return FREE_CONTACT_LIMIT;
    const packageName = (instance?.billing?.packageName ?? '').toLowerCase();
    return PLAN_LIMITS[packageName] ?? FREE_CONTACT_LIMIT;
  } catch {
    return FREE_CONTACT_LIMIT;
  }
}

export async function isWixToZohoAllowed(): Promise<boolean> {
  const limit = await getContactLimit();
  return limit > FREE_CONTACT_LIMIT;
}
