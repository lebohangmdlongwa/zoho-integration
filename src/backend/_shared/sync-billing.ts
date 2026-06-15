import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import { getSupabase } from './supabase-client';

const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);

export async function syncBillingToSupabase(
  instanceId: string,
  logPrefix: string,
): Promise<void> {
  const { instance } = await elevatedGetAppInstance();
  const supabase = getSupabase();
  const inst = instance as Record<string, unknown> | undefined;
  const billing = inst?.billing as Record<string, unknown> | undefined;

  await supabase
    .from('app_installations')
    .update({
      is_free: (inst?.isFree as boolean) ?? true,
      package_name: (billing?.packageName as string) ?? null,
      billing_cycle: (billing?.billingCycle as string) ?? null,
      billing_started_at: (billing?.timeStamp as string) ?? null,
      billing_expiration_date: (billing?.expirationDate as string) ?? null,
      auto_renewing: (billing?.autoRenewing as boolean) ?? null,
      free_trial_status:
        ((billing?.freeTrialInfo as Record<string, unknown>)?.status as string) ?? null,
    })
    .eq('instance_id', instanceId);

  console.log(`[${logPrefix}] tracked:`, instanceId);
}
