import type { FC } from 'react';
import { useState } from 'react';
import { Box, Cell, Layout, Loader, Text } from '@wix/design-system';
import {
  FREE_FEATURES,
  TIER_FEATURES_FALLBACK,
  openUpgradeUrl,
  formatPrice,
} from '../upgradeUtils';

const buildTiers = (planPricing: PlanPricing): PricingTier[] => {
  const freeTier: PricingTier = { name: 'Free', features: FREE_FEATURES };

  if (!planPricing.plans.length) {
    return [
      freeTier,
      { name: 'Light', monthlyPrice: '3', yearlyPrice: '1.5', savingsPercent: 50, features: TIER_FEATURES_FALLBACK.light, popular: true },
      { name: 'Core', monthlyPrice: '6', yearlyPrice: '4', savingsPercent: 33, features: TIER_FEATURES_FALLBACK.core },
      { name: 'Pro', monthlyPrice: '10', yearlyPrice: '7', savingsPercent: 30, features: TIER_FEATURES_FALLBACK.pro },
    ];
  }

  const { plans, showPriceWithTax } = planPricing;
  const priceKey = showPriceWithTax ? 'totalPrice' : 'priceBeforeTax';

  const lightIdx = plans.findIndex((p) => p.name.toLowerCase() === 'light');
  const popularIdx = lightIdx !== -1 ? lightIdx : 0;

  const premiumTiers: PricingTier[] = plans.map((plan, i) => {
    const monthlyEntry = plan.prices.find(
      (p) =>
        p.billingCycle.cycleDuration?.unit === 'MONTH' ||
        p.billingCycle.cycleType === 'ONE_TIME',
    );
    const yearlyEntry = plan.prices.find(
      (p) => p.billingCycle.cycleDuration?.unit === 'YEAR',
    );
    const monthly = monthlyEntry?.[priceKey];
    const yearly = yearlyEntry?.[priceKey];

    let savingsPercent: number | undefined;
    if (monthly && yearly) {
      const m = parseFloat(monthly);
      const y = parseFloat(yearly);
      if (m > 0) savingsPercent = Math.round(((m - y) / m) * 100);
    }

    return {
      name: plan.name,
      planId: plan._id,
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      savingsPercent,
      features: plan.benefits.length
        ? plan.benefits
        : (TIER_FEATURES_FALLBACK[plan.name.toLowerCase()] ?? FREE_FEATURES),
      popular: i === popularIdx,
    };
  });

  return [freeTier, ...premiumTiers];
};

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#3ba755" style={{ flexShrink: 0, marginTop: 2 }}>
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0 }}>
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
);

interface TierCardProps {
  tier: PricingTier;
  isPremium: boolean;
  packageName: string;
  isYearly: boolean;
  currency: string;
  upgradeUrl: string | undefined;
}

const TierCard: FC<TierCardProps> = ({
  tier,
  isPremium,
  packageName,
  isYearly,
  currency,
  upgradeUrl,
}) => {
  const tierName = tier.name.toLowerCase();
  const isCurrentPlan =
    tierName === 'free' ? !isPremium : isPremium && tierName === packageName;

  const rawPrice =
    isYearly && tier.yearlyPrice
      ? tier.yearlyPrice
      : (tier.monthlyPrice ?? null);
  const price = rawPrice ? formatPrice(rawPrice, currency) : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {tier.popular ? (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #2D6BDA 0%, #1a52b8 100%)',
              padding: '5px 18px',
              borderRadius: 50,
            }}
          >
            <Text size="tiny" weight="bold" light>Most Popular</Text>
          </div>
        </div>
      ) : (
        <div style={{ height: 33 }} />
      )}

      <div
        style={{
          flex: 1,
          background: '#fff',
          border: tier.popular ? '2px solid #2D6BDA' : '1.5px solid #e0e5eb',
          borderRadius: 16,
          padding: '28px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Text weight="bold" size="medium">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#101828' }}>
            {tier.name}
          </span>
        </Text>

        <div style={{ marginTop: 10, marginBottom: 6, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {price ? (
            <>
              <Text weight="bold" size="medium">
                <span style={{ fontSize: 38, fontWeight: 800, color: '#101828', lineHeight: 1 }}>
                  {price}
                </span>
              </Text>
              <div style={{ paddingBottom: 6 }}>
                <Text size="small" secondary>/mo</Text>
              </div>
            </>
          ) : (
            <Text weight="bold" size="medium">
              <span style={{ fontSize: 38, fontWeight: 800, color: '#101828', lineHeight: 1 }}>Free</span>
            </Text>
          )}
        </div>

        <div style={{ minHeight: 20, marginBottom: 18 }}>
          {isYearly && tier.yearlyPrice && (
            <Text size="tiny" secondary>
              Billed yearly ·{' '}
              {formatPrice((parseFloat(tier.yearlyPrice) * 12).toFixed(2), currency)}/yr
            </Text>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, marginBottom: 24 }}>
          {tier.features.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <CheckIcon />
              <Text size="small">{f}</Text>
            </div>
          ))}
        </div>

        {isCurrentPlan ? (
          <button
            disabled
            style={{
              width: '100%',
              padding: '12px',
              border: '1.5px solid #e0e5eb',
              borderRadius: 50,
              background: '#f9f9f9',
              cursor: 'not-allowed',
            }}
          >
            <Text size="small" secondary>Current plan</Text>
          </button>
        ) : (
          <button
            onClick={() => openUpgradeUrl(upgradeUrl)}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: 50,
              background: tier.popular
                ? 'linear-gradient(135deg, #2D6BDA 0%, #1a52b8 100%)'
                : '#101828',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {tier.popular && <StarIcon />}
            <Text size="small" weight="bold" light>
              {tier.monthlyPrice || tier.yearlyPrice
                ? `Upgrade to ${tier.name}`
                : `Get ${tier.name}`}
            </Text>
          </button>
        )}
      </div>
    </div>
  );
};

interface PlansPageProps {
  isPremium: boolean;
  packageName: string;
  upgradeUrl: string | undefined;
  planPricing: PlanPricing | null;
}

const PlansPage: FC<PlansPageProps> = ({
  isPremium,
  packageName,
  upgradeUrl,
  planPricing,
}) => {
  const [isYearly, setIsYearly] = useState(false);

  const loading = planPricing === null;
  const tiers = planPricing ? buildTiers(planPricing) : [];
  const currency = planPricing?.currency ?? 'USD';

  return (
    <div
      style={{
        padding: '20px 32px',
        background: '#f4f5f7',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Layout>
        <Cell span={12}>
          <Box direction="vertical" align="center" paddingBottom="SP2" paddingTop="SP3" gap="SP1">
            <Text size="medium" weight="bold">
              <span style={{ fontSize: 28, fontWeight: 700, color: '#101828' }}>
                Choose your plan
              </span>
            </Text>
            <Text secondary>
              Select the plan that fits your needs. Change plans anytime.
            </Text>
          </Box>
        </Cell>

        {!loading && (
          <Cell span={12}>
            <Box align="center" paddingBottom="SP4">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#fff',
                  border: '1px solid #d0d5dd',
                  borderRadius: 10,
                  padding: 4,
                  gap: 4,
                }}
              >
                <div
                  onClick={() => setIsYearly(false)}
                  style={{
                    padding: '6px 20px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                    ...(!isYearly ? { background: '#2D6BDA' } : { background: 'transparent' }),
                  }}
                >
                  <Text size="small" weight={isYearly ? 'normal' : 'bold'}>
                    <span style={{ color: isYearly ? '#667085' : '#fff' }}>Monthly</span>
                  </Text>
                </div>

                <div
                  onClick={() => setIsYearly(true)}
                  style={{
                    padding: '6px 20px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                    ...(isYearly ? { background: '#2D6BDA' } : { background: 'transparent' }),
                  }}
                >
                  <Text size="small" weight={isYearly ? 'bold' : 'normal'}>
                    <span style={{ color: isYearly ? '#fff' : '#667085' }}>Yearly</span>
                  </Text>
                  <div
                    style={{
                      background: '#3ba755',
                      borderRadius: 20,
                      padding: '2px 9px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Text size="tiny" weight="bold">
                      <span style={{ color: '#fff' }}>Save up to 25%</span>
                    </Text>
                  </div>
                </div>
              </div>
            </Box>
          </Cell>
        )}

        {loading && (
          <Cell span={12}>
            <Box align="center" padding="SP8">
              <Loader size="small" />
            </Box>
          </Cell>
        )}

        {!loading && (
          <Cell span={12}>
            <div
              style={{
                display: 'flex',
                gap: 16,
                maxWidth: 1080,
                margin: '0 auto',
                alignItems: 'stretch',
              }}
            >
              {tiers.map((tier) => (
                <TierCard
                  key={tier.name}
                  tier={tier}
                  isPremium={isPremium}
                  packageName={packageName}
                  isYearly={isYearly}
                  currency={currency}
                  upgradeUrl={upgradeUrl}
                />
              ))}
            </div>
          </Cell>
        )}
      </Layout>
    </div>
  );
};

export default PlansPage;
