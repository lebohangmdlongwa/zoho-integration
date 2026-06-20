import type { FC } from 'react';
import { s } from './styles/ManageContactsPage';
import { SuccessIcon, ErrorIcon, SearchIcon, SyncIcon, RefreshIcon, ExternalIcon, PersonIcon } from './icons/ManageContactsIcons';
import { relativeTime, shortId, directionLabel, initials, displayName, avatarColor } from './helpers/ManageContactsHelpers';
import { useState, useEffect, useCallback, useRef } from 'react';
import { httpClient } from '@wix/essentials';
import { Badge, Box, Loader, Text } from '@wix/design-system';
import ContactLimitModal from '../ContactLimitModal';
import { openUpgradeUrl } from '../upgradeUtils';
import { SyncErrors } from '../components/SyncErrors';

const activityStatusConfig = {
  success: { bg: '#f0faf3', border: '#b6e6c3', iconBg: '#dcf5e3' },
  error: { bg: '#fff5f5', border: '#f9c0c0', iconBg: '#fde0e0' },
  skipped: { bg: '#f9fafb', border: '#e4e7ec', iconBg: '#eef0f4' },
};

interface ContactRow {
  wix_id: string;
  zoho_id: string | null;
  last_synced_at: string;
  last_sync_source: 'wix' | 'zoho' | null;
  status: 'success' | 'error' | 'skipped';
  direction: string | null;
  error_message: string | null;
  first_name: string;
  last_name: string;
  email: string;
}

const EmptyContacts: FC<{ filtered: boolean }> = ({ filtered }) => (
  <div style={s.emptyContactsWrap}>
    <div style={s.emptyContactsIcon}>
      <PersonIcon />
    </div>
    <Text size="medium" weight="bold">
      <span style={{ color: '#101828' }}>
        {filtered ? 'No contacts match your filter' : 'No contacts synced yet'}
      </span>
    </Text>
    <Text size="small" secondary>
      <span style={{ textAlign: 'center', display: 'block', color: '#667085' }}>
        {filtered
          ? 'Try adjusting your search or filter criteria.'
          : 'Connect Zoho CRM and trigger a sync to see your contacts here.'}
      </span>
    </Text>
  </div>
);

const ManageContactsPage: FC<{ orgId?: string; upgradeUrl?: string; contactLimit?: number; onSyncComplete?: () => void }> = ({ orgId, upgradeUrl, contactLimit = 100, onSyncComplete }) => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncPollTimer, setSyncPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [contactLimitData, setContactLimitData] = useState<{ count: number; limit: number; skippedCount?: number } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const scrollRef = useRef<HTMLDivElement>(null);

  interface SyncRun {
    sync_id: string;
    synced_at: string;
    success: number;
    errors: number;
    skipped: number;
    total: number;
    directions: string[];
  }
  const [activityEntries, setActivityEntries] = useState<SyncRun[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(0);
  const ACTIVITY_PAGE_SIZE = 8;

  interface SyncErrorEntry { zoho_id: string | null; wix_id: string | null; direction: string; error_message: string | null; synced_at: string; }
  interface SyncErrorRun { sync_id: string; synced_at: string; count: number; entries: SyncErrorEntry[]; }
  const [syncErrorRuns, setSyncErrorRuns] = useState<SyncErrorRun[]>([]);
  const [syncErrorsLoading, setSyncErrorsLoading] = useState(false);

  const fetchContacts = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(pageNum) });
      const data = await httpClient
        .fetchWithAuth(`/api/zoho/contacts?${params}`)
        .then((r) => r.json());
      const newContacts: ContactRow[] = data.contacts ?? [];
      setContacts(prev => append ? [...prev, ...newContacts] : newContacts);
      setTotal(data.total ?? 0);
      setHasMore(newContacts.length === PAGE_SIZE);
      const errored = newContacts.filter(c => c.status === 'error');
      if (errored.length > 0) {
        console.warn('[Zoho Sync] Contacts needing resync:', errored.map(c => ({ wix_id: c.wix_id, zoho_id: c.zoho_id, error: c.error_message })));
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [search]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom && hasMore && !loadingMore) {
      setPage(p => p + 1);
    }
  }, [hasMore, loadingMore]);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await httpClient
        .fetchWithAuth('/api/zoho/sync-log')
        .then((r) => r.json());
      setActivityEntries(data.runs ?? []);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const fetchSyncErrors = useCallback(async () => {
    setSyncErrorsLoading(true);
    try {
      const data = await httpClient
        .fetchWithAuth('/api/zoho/sync-log?errors=1')
        .then((r) => r.json());
      setSyncErrorRuns(data.runs ?? []);
    } finally {
      setSyncErrorsLoading(false);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('pending');

    try {
      const res = await httpClient.fetchWithAuth('/api/zoho/sync-trigger', { method: 'POST' });
      const data = await res.json() as { jobId?: string; status?: string; alreadyRunning?: boolean; error?: string };

      if (!data.jobId) {
        console.error('[Zoho Sync] trigger failed', data.error);
        setSyncing(false);
        setSyncStatus('');
        return;
      }

      if (data.alreadyRunning && data.status) setSyncStatus(data.status);

      const timer = setInterval(async () => {
        try {
          const statusRes = await httpClient.fetchWithAuth(`/api/zoho/sync-job-status?jobId=${data.jobId}`);
          const job = await statusRes.json() as { status: string; stats?: Record<string, unknown>; error?: string };

          setSyncStatus(job.status);

          if (job.status === 'done' || job.status === 'failed') {
            clearInterval(timer);
            setSyncPollTimer(null);
            setSyncing(false);
            setSyncStatus('');
            if (job.status === 'done') {
              setPage(0);
              await Promise.all([fetchContacts(0, false), fetchActivity(), fetchSyncErrors()]);
              onSyncComplete?.();
              if (job.stats?.wixToZohoBlocked) {
                const zohoCount = job.stats.zohoContactCount as number | undefined;
                const limit = (job.stats.contactLimit as number | undefined) ?? contactLimit;
                setContactLimitData({
                  count: zohoCount ?? limit,
                  limit,
                  skippedCount: zohoCount !== undefined ? Math.max(0, zohoCount - limit) : undefined,
                });
              }
            } else {
              console.error('[Zoho Sync] job failed', job.error);
            }
          }
        } catch (err) {
          console.error('[Zoho Sync] poll error', err);
        }
      }, 3000);

      setSyncPollTimer(timer);
    } catch (err) {
      console.error('[Zoho Sync] network/runtime error', err);
      setSyncing(false);
      setSyncStatus('');
    }
  };

  useEffect(() => () => { if (syncPollTimer) clearInterval(syncPollTimer); }, [syncPollTimer]);

  useEffect(() => {
    setPage(0);
    void fetchContacts(0, false);
    void fetchActivity();
    void fetchSyncErrors();
  }, [fetchContacts, fetchActivity, fetchSyncErrors]);

  useEffect(() => {
    if (page === 0) return;
    void fetchContacts(page, true);
  }, [page]);

  return (
    <div style={s.page}>
      {contactLimitData !== null && (
        <ContactLimitModal
          contactCount={contactLimitData.count}
          planLimit={contactLimitData.limit}
          skippedCount={contactLimitData.skippedCount}
          onUpgrade={() => {
            openUpgradeUrl(upgradeUrl);
            setContactLimitData(null);
          }}
          onClose={() => setContactLimitData(null)}
        />
      )}

      {/* Main table card */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <Text size="medium" weight="bold">
            <span style={{ color: '#101828' }}>Synced Contacts</span>
          </Text>
        </div>

        <div style={s.toolbar}>
          <div style={s.filterRow}>
            <button style={s.filterBtn(true)}>
              <Text size="tiny" weight="bold">
                <span style={{ color: '#fff' }}>All contacts</span>
              </Text>
            </button>
          </div>

          <div style={s.searchWrap}>
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search by contact name or email…"
              style={s.searchInput}
            />
          </div>

          <button onClick={handleSync} disabled={syncing} style={s.syncBtn(syncing)}>
            {syncing ? <Loader size="tiny" /> : <SyncIcon />}
            <Text size="tiny" weight="bold" light>
              {syncing
                ? syncStatus === 'running_phase1' ? 'Wix → Zoho…'
                : syncStatus === 'running_phase2' ? 'Zoho → Wix…'
                : 'Starting…'
                : 'Sync All'}
            </Text>
          </button>

          <button
            onClick={() => { setPage(0); void fetchContacts(0, false); }}
            title="Refresh"
            style={s.iconBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF3FF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <RefreshIcon />
          </button>
        </div>

        <div style={s.thead}>
          {['Contact', 'Zoho ID', 'Sync Direction', 'Last Synced', 'Status'].map((h) => (
            <Text key={h} size="tiny" weight="bold">
              <span style={s.theadLabel}>{h}</span>
            </Text>
          ))}
        </div>

        {loading ? (
          <Box padding="SP8" align="center">
            <Loader size="small" />
          </Box>
        ) : contacts.length === 0 ? (
          <EmptyContacts filtered={search !== ''} />
        ) : (
          <div ref={scrollRef} style={s.tableScroll} onScroll={handleScroll}>
            {contacts.map((c) => (
              <div
                key={c.wix_id}
                style={s.trow}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
              >
                <div style={s.contactCell}>
                  <div style={s.avatar(avatarColor(c.wix_id))}>
                    <Text size="tiny" weight="bold">
                      <span style={{ color: '#fff', fontSize: 11 }}>{initials(c)}</span>
                    </Text>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text size="small">
                      <span style={s.contactName}>{displayName(c)}</span>
                    </Text>
                    {c.email && (c.first_name || c.last_name) && (
                      <Text size="tiny" secondary>
                        <span style={s.contactEmail}>{c.email}</span>
                      </Text>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text size="small">
                    <span style={{ color: c.zoho_id ? '#344054' : '#9aa5b4' }}>
                      {shortId(c.zoho_id)}
                    </span>
                  </Text>
                  {c.zoho_id && (
                    <span
                      onClick={() => window.open(`https://crm.zoho.com/crm/org${orgId ?? '0'}/tab/Contacts/${c.zoho_id}`, '_blank')}
                      title="Open in Zoho CRM"
                      style={s.hsIdLink}
                    >
                      <ExternalIcon />
                    </span>
                  )}
                </div>

                <Text size="small" secondary>
                  <span style={{ color: '#667085' }}>{directionLabel(c.direction)}</span>
                </Text>
                <Text size="small" secondary>
                  <span style={{ color: '#667085' }}>{relativeTime(c.last_synced_at)}</span>
                </Text>

                <div>
                  <Badge
                    skin={c.status === 'success' ? 'success' : c.status === 'skipped' ? 'neutral' : 'warning'}
                    size="small"
                  >
                    {c.status === 'success' ? 'Synced' : c.status === 'skipped' ? 'Skipped' : 'Resync'}
                  </Badge>
                </div>
              </div>
            ))}

            {loadingMore && (
              <Box padding="SP4" align="center">
                <Loader size="tiny" />
              </Box>
            )}
          </div>
        )}

        <div style={s.footer}>
          <Text size="tiny" secondary>
            <span style={{ color: '#667085' }}>
              Showing {contacts.length} of {total} synced contact{total !== 1 ? 's' : ''}
            </span>
          </Text>
        </div>
      </div>

      <SyncErrors runs={syncErrorRuns} loading={syncErrorsLoading} onRefresh={fetchSyncErrors} />

      {/* Recent Activity */}
      <div style={s.activitySection}>
        <div style={s.sectionHeading}>
          <Text size="medium" weight="bold">
            <span style={{ color: '#101828' }}>Recent Activity</span>
          </Text>
          <div style={{ flex: 1, height: 1, background: '#e8ecf1' }} />
          <button
            onClick={() => { setActivityPage(0); void fetchActivity(); }}
            disabled={activityLoading}
            title="Refresh activity"
            style={{ ...s.iconBtn, width: 30, height: 30 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF3FF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <RefreshIcon />
          </button>
        </div>

        {!loading && total > 0 && (
          <div style={s.totalSyncedCard}>
            <Text size="tiny" secondary>
              <span style={{ color: '#667085' }}>Total Synced</span>
            </Text>
            <Text weight="bold">
              <span style={{ color: '#2D6BDA', fontSize: 22, fontWeight: 700 }}>
                {total}
              </span>
            </Text>
          </div>
        )}

        <div style={s.card}>
          {activityLoading ? (
            <Box padding="SP8" align="center">
              <Loader size="small" />
            </Box>
          ) : activityEntries.length === 0 ? (
            <div style={s.activityEmpty}>
              <Text size="small" secondary>
                <span style={{ color: '#9aa5b4' }}>
                  No sync activity yet. Trigger a sync to see events here.
                </span>
              </Text>
            </div>
          ) : (
            (() => {
              const totalActivityPages = Math.ceil(activityEntries.length / ACTIVITY_PAGE_SIZE);
              const pageEntries = activityEntries.slice(
                activityPage * ACTIVITY_PAGE_SIZE,
                (activityPage + 1) * ACTIVITY_PAGE_SIZE,
              );
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {pageEntries.map((run, idx) => {
                      const hasErrors = run.errors > 0;
                      const cfg = hasErrors ? activityStatusConfig.error : activityStatusConfig.success;
                      const isLast = idx === pageEntries.length - 1;
                      const dirLabel = run.directions
                        .map((d) =>
                          d === 'wix_to_zoho' ? 'Wix → Zoho'
                          : d === 'zoho_to_wix' ? 'Zoho → Wix'
                          : d.replace(/_/g, ' '),
                        )
                        .join(' & ');
                      return (
                        <div key={run.sync_id} style={s.activityRow(isLast)}>
                          <div style={s.activityIcon(cfg.iconBg, cfg.border)}>
                            {hasErrors ? <ErrorIcon /> : <SuccessIcon />}
                          </div>
                          <div style={s.activityContent}>
                            <div style={s.activityHeader}>
                              <Text size="small" weight="bold">
                                <span>Sync — {run.total} contact{run.total !== 1 ? 's' : ''}</span>
                              </Text>
                              <Badge skin={hasErrors ? 'danger' : 'success'} size="small">
                                {hasErrors ? `${run.errors} error${run.errors !== 1 ? 's' : ''}` : 'success'}
                              </Badge>
                            </div>
                            <div style={s.activityMeta}>
                              {dirLabel && <Text size="tiny" secondary>{dirLabel}</Text>}
                              {run.success > 0 && <Text size="tiny" secondary>{run.success} synced</Text>}
                              {run.skipped > 0 && <Text size="tiny" secondary>{run.skipped} skipped</Text>}
                            </div>
                          </div>
                          <div style={s.activityTime}>
                            <Text size="tiny" secondary>{relativeTime(run.synced_at)}</Text>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ ...s.footer, borderTop: '1px solid #e8ecf1' }}>
                    <Text size="tiny" secondary>
                      <span style={{ color: '#667085' }}>
                        {activityPage * ACTIVITY_PAGE_SIZE + 1}–
                        {Math.min((activityPage + 1) * ACTIVITY_PAGE_SIZE, activityEntries.length)}{' '}
                        of {activityEntries.length} sync run{activityEntries.length !== 1 ? 's' : ''}
                      </span>
                    </Text>
                    {totalActivityPages > 1 && (
                      <div style={s.paginationRow}>
                        <button
                          disabled={activityPage === 0}
                          onClick={() => setActivityPage((p) => p - 1)}
                          style={s.activityPaginationBtn(activityPage === 0)}
                        >
                          <Text size="tiny"><span style={{ color: '#344054' }}>← Prev</span></Text>
                        </button>
                        <Text size="tiny" secondary>
                          <span style={{ color: '#667085' }}>{activityPage + 1} / {totalActivityPages}</span>
                        </Text>
                        <button
                          disabled={activityPage + 1 >= totalActivityPages}
                          onClick={() => setActivityPage((p) => p + 1)}
                          style={s.activityPaginationBtn(activityPage + 1 >= totalActivityPages)}
                        >
                          <Text size="tiny"><span style={{ color: '#344054' }}>Next →</span></Text>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

    </div>
  );
};

export default ManageContactsPage;
