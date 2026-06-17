import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { httpClient } from '@wix/essentials';
import { Text } from '@wix/design-system';
import { s } from './styles/DealsPage';

interface DealRow {
  id: string;
  zoho_deal_id: string;
  deal_name: string | null;
  stage: string | null;
  amount: number | null;
  closing_date: string | null;
  contact_name: string | null;
}

function buildDealUrl(apiDomain: string | null, orgId: string | null, dealId: string): string | null {
  if (!apiDomain || !orgId) return null;
  // Convert "https://www.zohoapis.com" → "https://crm.zoho.com"
  const crmBase = apiDomain.replace('www.zohoapis.', 'crm.zoho.');
  return `${crmBase}/crm/org${orgId}/tab/Potentials/${dealId}`;
}

function stageColor(stage: string | null): { color: string; bg: string } {
  if (!stage) return { color: '#667085', bg: '#f2f4f7' };
  const lower = stage.toLowerCase();
  if (lower.includes('won')) return { color: '#027a48', bg: '#ecfdf3' };
  if (lower.includes('lost')) return { color: '#b42318', bg: '#fff1f0' };
  if (lower.includes('negotiat') || lower.includes('review')) return { color: '#b54708', bg: '#fffaeb' };
  if (lower.includes('proposal') || lower.includes('quote')) return { color: '#175cd3', bg: '#eff4ff' };
  if (lower.includes('value') || lower.includes('analysis')) return { color: '#5925dc', bg: '#f4f3ff' };
  return { color: '#2D6BDA', bg: '#EEF3FF' };
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LIMIT = 50;

const SkeletonRows: FC = () => (
  <div style={{ padding: '0 20px' }}>
    <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: '1px solid #f0f4f7' }}>
        <div style={{ flex: 2, height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ flex: 1.2, height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ flex: 1.4, height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ flex: 1, height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ flex: 1.4, height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
      </div>
    ))}
  </div>
);

const DealsIcon: FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
  </svg>
);

const SyncIcon: FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
);

const DealsPage: FC = () => {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [apiDomain, setApiDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncPollTimer, setSyncPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async (offset = 0, append = false) => {
    const res = await httpClient.fetchWithAuth(`/api/zoho/deals?limit=${LIMIT}&offset=${offset}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      const text = await res.text().catch(() => '');
      console.error('[DealsPage] server returned non-JSON (route crashed). Status:', res.status, 'Preview:', text.slice(0, 400));
      throw new Error(`Server error HTTP ${res.status} — check the terminal for details`);
    }
    const body = await res.json() as { deals?: DealRow[]; total?: number; orgId?: string | null; apiDomain?: string | null; error?: string };
    if (!res.ok || body.error) {
      const msg = body.error || `HTTP ${res.status}`;
      console.error('[DealsPage] fetchDeals API error:', msg);
      throw new Error(msg);
    }
    setDeals(prev => append ? [...prev, ...(body.deals ?? [])] : (body.deals ?? []));
    setTotal(body.total ?? 0);
    if (!append) {
      setOrgId(body.orgId ?? null);
      setApiDomain(body.apiDomain ?? null);
    }
  }, []);

  useEffect(() => {
    fetchDeals(0)
      .catch(err => {
        console.error('[DealsPage] initial load failed:', err);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [fetchDeals]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('pending');

    try {
      const res = await httpClient.fetchWithAuth('/api/zoho/deals-sync-trigger', { method: 'POST' });
      const data = await res.json() as { jobId?: string; status?: string; alreadyRunning?: boolean; error?: string };

      if (!data.jobId) {
        console.error('[Deals Sync] trigger failed:', data.error);
        setSyncing(false);
        setSyncStatus('');
        return;
      }

      console.log('[Deals Sync] job created:', data.jobId, data.alreadyRunning ? '(already running)' : '');
      if (data.alreadyRunning && data.status) setSyncStatus(data.status);

      const timer = setInterval(async () => {
        try {
          const statusRes = await httpClient.fetchWithAuth(`/api/zoho/sync-job-status?jobId=${data.jobId}`);
          const job = await statusRes.json() as { status: string; stats?: Record<string, unknown>; error?: string };

          const upserted = (job.stats?.dealsUpserted as number | undefined) ?? 0;
          const skipped = (job.stats?.dealsSkipped as number | undefined) ?? 0;
          const label = upserted > 0 ? `${job.status} — ${upserted} deals synced` : job.status;
          setSyncStatus(label);
          console.log('[Deals Sync] poll:', job.status, job.stats ?? {});

          if (job.status === 'done' || job.status === 'failed') {
            clearInterval(timer);
            setSyncPollTimer(null);
            setSyncing(false);
            setSyncStatus('');

            if (job.status === 'done') {
              console.log('[Deals Sync] complete:', { upserted, skipped });
              await fetchDeals(0).catch(() => null);
            } else {
              console.error('[Deals Sync] job failed:', job.error, job.stats);
              setError(`Sync failed: ${job.error ?? 'unknown error'}. Check browser console for details.`);
            }
          }
        } catch (err) {
          console.error('[Deals Sync] poll error:', err);
        }
      }, 3000);

      setSyncPollTimer(timer);
    } catch (err) {
      console.error('[Deals Sync] network/runtime error:', err);
      setSyncing(false);
      setSyncStatus('');
    }
  };

  useEffect(() => () => { if (syncPollTimer) clearInterval(syncPollTimer); }, [syncPollTimer]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await fetchDeals(deals.length, true).catch(() => null);
    setLoadingMore(false);
  };

  const totalValue = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const openDeals = deals.filter(d => {
    const lower = (d.stage ?? '').toLowerCase();
    return !lower.includes('won') && !lower.includes('lost');
  }).length;

  return (
    <div style={s.page}>
      {/* Stats row */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <span style={s.statLabel}>Total Deals</span>
          <span style={s.statValue}>{total}</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statLabel}>Open Deals</span>
          <span style={s.statValue}>{openDeals}</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statLabel}>Total Value</span>
          <span style={s.statValue}>{loading ? '…' : formatCurrency(totalValue)}</span>
        </div>
      </div>

      {/* Table card */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Text size="medium" weight="bold">All Deals</Text>
            {syncStatus && <Text size="tiny" secondary>{syncStatus}</Text>}
          </div>
          <button style={s.syncBtn(syncing)} onClick={handleSync} disabled={syncing}>
            <SyncIcon />
            {syncing ? 'Syncing…' : 'Sync Deals'}
          </button>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <div style={s.emptyWrap}>
            <Text size="small">{error}</Text>
          </div>
        ) : deals.length === 0 ? (
          <div style={s.emptyWrap}>
            <div style={s.emptyIcon}>
              <DealsIcon />
            </div>
            <Text size="medium" weight="bold">No deals synced yet</Text>
            <Text size="small" secondary>Click "Sync Deals" to pull your Zoho deals into this view.</Text>
          </div>
        ) : (
          <>
            <div style={s.tableScroll}>
              <div style={s.thead}>
                <span style={s.theadLabel}>Deal</span>
                <span style={s.theadLabel}>Amount</span>
                <span style={s.theadLabel}>Stage</span>
                <span style={s.theadLabel}>Closing Date</span>
                <span style={s.theadLabel}>Contact</span>
              </div>
              {deals.map((deal, i) => {
                const { color, bg } = stageColor(deal.stage);
                const dealUrl = buildDealUrl(apiDomain, orgId, deal.zoho_deal_id);
                return (
                  <div
                    key={deal.zoho_deal_id}
                    style={s.trow(i === deals.length - 1, !!dealUrl)}
                    onClick={() => dealUrl && window.open(dealUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <div style={s.dealNameCell}>
                      <span style={s.dealName}>{deal.deal_name ?? '—'}</span>
                      <span style={s.dealId}>{deal.zoho_deal_id}</span>
                    </div>
                    <span style={s.amount}>{formatCurrency(deal.amount)}</span>
                    <span style={s.stageBadge(color, bg)}>{deal.stage ?? '—'}</span>
                    <span style={s.date}>{formatDate(deal.closing_date)}</span>
                    <span style={s.contact}>{deal.contact_name ?? '—'}</span>
                  </div>
                );
              })}
            </div>

            <div style={s.footer}>
              <Text size="tiny" secondary>Showing {deals.length} of {total} deals</Text>
              {deals.length < total && (
                <button
                  style={s.loadMoreBtn(loadingMore)}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DealsPage;
