import { appInstances } from "@wix/app-management";
import { syncBillingToSupabase } from "../../../../backend/_shared/sync-billing";

export default (appInstances as any).onAppInstancePaidPlanPurchased(async (event: any) => {
  try {
    const instanceId = event.metadata?.instanceId;
    if (!instanceId) {
      console.warn("[plan-purchased] no instanceId in event");
      return;
    }
    await syncBillingToSupabase(instanceId, "plan-purchased");
  } catch (error) {
    console.error("[plan-purchased] failed:", error);
  }
});
