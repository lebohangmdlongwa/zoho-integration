import { auth } from "@wix/essentials";
import { appInstances } from "@wix/app-management";
import { siteProperties } from "@wix/business-tools";
import { getSupabase } from "../../../../backend/_shared/db";

const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
const elevatedGetSiteProps = auth.elevate(siteProperties.getSiteProperties);

export default (appInstances as any).onAppInstanceInstalled(async (event: any) => {
  try {
    const instanceId = event.metadata?.instanceId;
    if (!instanceId) {
      console.warn("[app-installed] no instanceId in event, skipping");
      return;
    }
    const siteId = event.metadata?.accountInfo?.siteId;

    const { instance, site } = await elevatedGetAppInstance();

    let businessName: string | null = null;
    let phone: string | null = null;
    let country: string | null = null;
    let city: string | null = null;
    let category: string | null = null;
    let subCategory: string | null = null;
    try {
      const props = await elevatedGetSiteProps();
      const p = props as any;
      businessName = p?.properties?.businessName ?? null;
      phone = p?.properties?.phone ?? null;
      country = p?.properties?.address?.country ?? null;
      city = p?.properties?.address?.city ?? null;
      category = p?.properties?.categories?.primary ?? null;
      subCategory = p?.properties?.categories?.secondary?.[0] ?? null;
    } catch (err) {
      console.warn("[app-installed] getSiteProperties failed:", err);
    }

    const supabase = getSupabase();

    await supabase.from("app_installations").upsert(
      {
        instance_id: instanceId,
        app_name: (instance as any)?.appName ?? null,
        site_id: (site as any)?.siteId ?? siteId,
        owner_email: (site as any)?.ownerInfo?.email ?? null,
        business_name: businessName,
        phone,
        country,
        city,
        category,
        sub_category: subCategory,
        site_display_name: site?.siteDisplayName ?? null,
        site_url: (site as any)?.url ?? null,
        site_locale: (site as any)?.locale ?? null,
        is_free: (instance as any)?.isFree ?? true,
        package_name: (instance as any)?.billing?.packageName ?? null,
        billing_cycle: (instance as any)?.billing?.billingCycle ?? null,
        billing_started_at: (instance as any)?.billing?.timeStamp ?? null,
        billing_expiration_date:
          (instance as any)?.billing?.expirationDate ?? null,
        auto_renewing: (instance as any)?.billing?.autoRenewing ?? null,
        free_trial_status:
          (instance as any)?.billing?.freeTrialInfo?.status ?? null,
        installed_at: new Date().toISOString(),
        removed_at: null,
        is_active: true
      },
      { onConflict: "instance_id" }
    );

    console.log("[app-installed] tracked:", instanceId);
  } catch (error) {
    console.error("[app-installed] failed:", error);
  }
});
