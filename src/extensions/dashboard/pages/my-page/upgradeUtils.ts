export const FREE_FEATURES = [
  'One-way sync (Zoho CRM → Wix)',
  'Up to 100 contacts',
  'Manual sync only',
  '24/7 support',
];

export const TIER_FEATURES_FALLBACK: Record<string, string[]> = {
  light: ['Bidirectional sync', 'Up to 1,000 contacts', '24/7 support'],
  core: ['Bidirectional sync', 'Up to 10,000 contacts', '24/7 support'],
  pro: ['Bidirectional sync', 'More than 10,000 contacts', 'Priority support'],
};

export const PREMIUM_FEATURES = TIER_FEATURES_FALLBACK.pro;

export const openUpgradeUrl = (url: string | undefined) => {
  if (!url) return;
  window.open(url, '_blank');
};

export const formatPrice = (raw: string, currency: string): string => {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(num);
};
