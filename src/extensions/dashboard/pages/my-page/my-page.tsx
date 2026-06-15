import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { httpClient } from '@wix/essentials';
import { appPlans } from '@wix/app-management';
import { dashboard } from '@wix/dashboard';
import {
  Box,
  Card,
  Cell,
  CustomModalLayout,
  Layout,
  Loader,
  Modal,
  Text,
  WixDesignSystemProvider,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import Sidebar, { type PageKey } from './components/Sidebar';
import Topbar from './components/Topbar';
import { MoreAppsByUs } from './components/MoreAppsByUs';
import { openUpgradeUrl } from './upgradeUtils';
import ManageContactsPage from './pages/ManageContactsPage';
import FieldMappingPage from './pages/FieldMappingPage';
import PlansPage from './pages/PlansPage';
import SupportPage from './pages/SupportPage';
import ZohoCRMSplash from './components/ZohoCRMSplash';
import ContactLimitModal from './ContactLimitModal';
import { openRatePopup } from '../../_shared/rate-popup';

const APP_ID = '1742b6a3-e4ad-4381-a2bc-961133180800';
const REVIEW_URL = `https://www.wix.com/app-market/add-review/${APP_ID}`;
const REVIEW_SHOWN_KEY = 'zoho_integration_review_shown_v1';

const ZOHO_BLUE = '#2D6BDA';

const SkeletonRows: FC<{ rows?: number }> = ({ rows = 4 }) => (
  <>
    <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #f0f4f7' }}>
        <div style={{ flex: 1, height: 16, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ width: '25%', height: 16, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ width: '15%', height: 16, borderRadius: 4, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.5s infinite' }} />
      </div>
    ))}
  </>
);

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

interface SetupStep {
  label: string;
  complete: boolean;
  optional?: boolean;
  page: PageKey;
}

const SetupProgressBar: FC<{ steps: SetupStep[]; onNavigate: (page: PageKey) => void }> = ({ steps, onNavigate }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 32px', background: '#fff', borderBottom: '1px solid #e8ecf1', flexShrink: 0, overflowX: 'auto' }}>
    {steps.flatMap((step, i) => {
      const items: JSX.Element[] = [
        <div key={`step-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onNavigate(step.page)}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step.complete ? ZOHO_BLUE : '#f4f5f7',
              border: `2px solid ${step.complete ? ZOHO_BLUE : '#d0d5dd'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
              boxShadow: step.complete ? '0 2px 8px rgba(45,107,218,0.35)' : '0 2px 6px rgba(0,0,0,0.10)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.2)';
              e.currentTarget.style.boxShadow = step.complete ? '0 4px 14px rgba(45,107,218,0.5)' : '0 4px 12px rgba(0,0,0,0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = step.complete ? '0 2px 8px rgba(45,107,218,0.35)' : '0 2px 6px rgba(0,0,0,0.10)';
            }}
          >
            {step.complete ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            ) : (
              <Text size="tiny" weight="bold">
                <span style={{ color: '#667085' }}>{i + 1}</span>
              </Text>
            )}
          </button>
          <Text size="tiny">
            <span style={{ color: step.complete ? ZOHO_BLUE : '#667085', fontWeight: step.complete ? 600 : 400, whiteSpace: 'nowrap' }}>
              {step.label}{step.optional ? ' (optional)' : ''}
            </span>
          </Text>
        </div>,
      ];
      if (i < steps.length - 1) {
        items.push(
          <div key={`line-${i}`} style={{ flex: 1, height: 2, background: step.complete ? ZOHO_BLUE : '#e8ecf1', margin: '16px 8px 0', minWidth: 20, transition: 'background 0.3s ease' }} />,
        );
      }
      return items;
    })}
  </div>
);

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  contacts: 'Manage Contacts',
  widget: 'Widget',
  fieldMapping: 'Field Mapping',
  activity: 'Recent Activity',
  embedSecurity: 'Embed Security',
  plans: 'Plans',
  support: 'Support',
};

const DashboardPage: FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncPollTimer, setSyncPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [webhookRegistered, setWebhookRegistered] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showPreConnectModal, setShowPreConnectModal] = useState(false);
  const [showPostConnectModal, setShowPostConnectModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [fieldsMapped, setFieldsMapped] = useState(() => {
    try { return localStorage.getItem('zoho_fields_mapped') === '1'; } catch { return false; }
  });
  const [upgradeUrl, setUpgradeUrl] = useState<string | undefined>();
  const [isPremium, setIsPremium] = useState(false);
  const [contactLimit, setContactLimit] = useState<number>(100);
  const [contactLimitData, setContactLimitData] = useState<{ count: number; limit: number; skippedCount?: number } | null>(null);
  const [packageName, setPackageName] = useState('');
  const [planPricing, setPlanPricing] = useState<PlanPricing | null>(null);
  const [reviewShown, setReviewShown] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(REVIEW_SHOWN_KEY) === '1',
  );
  const [pageLoading, setPageLoading] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const LOG_PAGE_SIZE = 6;

  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const editorUrl = dashboard.getSiteInfo()?.editorUrl ?? null;

  const loadPlan = useCallback(async () => {
    try {
      const data = await httpClient
        .fetchWithAuth('/api/check-plan')
        .then((r) => r.json()) as {
          isPremium: boolean;
          packageName: string;
          upgradeUrl?: string;
          contactLimit?: number;
        };
      setIsPremium(data.isPremium);
      setPackageName(data.packageName ?? '');
      setUpgradeUrl(data.upgradeUrl);
      if (data.contactLimit !== null && data.contactLimit !== undefined) {
        setContactLimit(data.contactLimit);
      }
    } catch (err) {
      console.error('[loadPlan] failed:', err);
    }
  }, []);

  const loadPlanPricing = useCallback(() => {
    const p = appPlans.listAppPlansByAppId([APP_ID]);
    p.catch((err: unknown) => {
      console.error('[loadPlanPricing] failed:', err);
      setPlanPricing({ plans: [], currency: 'USD', showPriceWithTax: false });
    });
    p.then((res: any) => {
      const plans = res.appPlans?.[0]?.plans ?? [];
      setPlanPricing({
        plans: plans as AppPlan[],
        currency: res.currency ?? 'USD',
        showPriceWithTax: res.taxSettings?.showPriceWithTax ?? false,
      });
    });
  }, []);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s: SyncStatus = await httpClient
        .fetchWithAuth('/api/zoho/status')
        .then((r) => r.json());
      setStatus(s);
      if (!s?.connected) {
        try { localStorage.removeItem('zoho_fields_mapped'); } catch { /* ignore */ }
        setFieldsMapped(false);
      }
    } finally {
      setStatusLoading(false);
      setAppLoading(false);
    }
  }, []);

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    setLogPage(0);
    try {
      setSyncLog(
        (await httpClient.fetchWithAuth('/api/zoho/sync-log').then((r) => r.json())).entries ?? [],
      );
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchLog();
    void loadPlan();
    void loadPlanPricing();
  }, [fetchStatus, fetchLog, loadPlan, loadPlanPricing]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadPlan();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadPlan]);

  useEffect(() => () => { if (syncPollTimer) clearInterval(syncPollTimer); }, [syncPollTimer]);

  const startSyncPoll = (jobId: string, onDone?: () => void) => {
    const timer = setInterval(async () => {
      try {
        const res = await httpClient.fetchWithAuth(`/api/zoho/sync-job-status?jobId=${jobId}`);
        const job = await res.json() as { status: string; stats?: Record<string, number>; error?: string };
        setSyncStatus(job.status);
        if (job.status === 'done' || job.status === 'failed') {
          clearInterval(timer);
          setSyncPollTimer(null);
          setSyncing(false);
          setSyncStatus('');
          if (job.status === 'done') {
            await Promise.all([fetchLog(), fetchStatus()]);
            onDone?.();
          } else {
            console.error('[Zoho Sync] job failed', job.error);
          }
        }
      } catch (err) {
        console.error('[Zoho Sync] poll error', err);
      }
    }, 3000);
    setSyncPollTimer(timer);
  };

  const enqueueSyncJob = async (onDone?: () => void) => {
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
      startSyncPoll(data.jobId, onDone);
    } catch (err) {
      console.error('[Zoho Sync] network/runtime error', err);
      setSyncing(false);
      setSyncStatus('');
    }
  };

  const handleConnectClick = () => setShowPreConnectModal(true);

  const handleConnect = async () => {
    setShowPreConnectModal(false);
    setConnecting(true);
    try {
      const { authUrl } = await httpClient
        .fetchWithAuth('/api/zoho/oauth-initiate')
        .then((r) => r.json());
      const popup = window.open(authUrl, 'zoho-oauth', 'width=620,height=720');
      const listener = async (e: MessageEvent) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type !== 'zoho-code') return;
        window.removeEventListener('message', listener);
        popup?.close();
        try {
          await httpClient.fetchWithAuth('/api/zoho/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: e.data.code }),
          });
        } catch (err) {
          console.error('[Zoho connect] exchange-token failed', err);
        }
        void fetchStatus().then(() => setShowPostConnectModal(true));
      };
      window.addEventListener('message', listener);
    } finally {
      setConnecting(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setRegisteringWebhook(true);
    setWebhookRegistered(false);
    try {
      const res = await httpClient.fetchWithAuth('/api/zoho/register-webhook', { method: 'POST' });
      if (res.ok) {
        setWebhookRegistered(true);
        void fetchStatus();
        setTimeout(() => setWebhookRegistered(false), 4000);
      }
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const handleDisconnect = () => setShowDisconnectModal(true);

  const confirmDisconnect = async () => {
    setDisconnecting(true);
    try {
      await httpClient.fetchWithAuth('/api/zoho/disconnect', { method: 'POST' });
      setShowDisconnectModal(false);
      void fetchStatus();
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = () => void enqueueSyncJob();

  const handleSyncAndNavigate = () => {
    setShowPostConnectModal(false);
    const isFirstSync = !reviewShown;
    void enqueueSyncJob(() => {
      setCurrentPage('contacts');
      if (isFirstSync) {
        try { localStorage.setItem(REVIEW_SHOWN_KEY, '1'); } catch { /* ignore */ }
        setReviewShown(true);
        setTimeout(() => openRatePopup(REVIEW_URL), 2000);
      }
    });
  };

  const setupSteps: SetupStep[] = [
    { label: 'Connect Zoho CRM', complete: !!status?.connected, page: 'dashboard' },
    { label: 'Sync Data', complete: !!status?.lastSyncAt, page: 'dashboard' },
    { label: 'Manage Contacts', complete: (status?.contactsSynced ?? 0) > 0, page: 'contacts' },
    { label: 'Map Fields', complete: fieldsMapped, page: 'fieldMapping' },
  ];
  const allSetupComplete = setupSteps.every((s) => s.complete);

  const syncLabel = syncing
    ? syncStatus === 'running_phase1' ? 'Wix → Zoho…'
    : syncStatus === 'running_phase2' ? 'Zoho → Wix…'
    : 'Starting…'
    : 'Sync Now';

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      {appLoading && <ZohoCRMSplash fullScreen />}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', overflow: 'hidden', fontFamily: 'inherit' }}>
        {/* Sidebar */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          isConnected={!!status?.connected}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded((e) => !e)}
        />

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f4f5f7' }}>
          {/* Topbar */}
          <Topbar
            pageTitle={PAGE_TITLES[currentPage]}
            isConnected={!!status?.connected}
            orgId={status?.orgId?.toString()}
            onUpgrade={() => openUpgradeUrl(upgradeUrl)}
            editorUrl={editorUrl}
          />

          {/* Setup progress bar */}
          {!statusLoading && !allSetupComplete && (
            <SetupProgressBar steps={setupSteps} onNavigate={setCurrentPage} />
          )}

          {/* Setup banner */}
          {!statusLoading && !status?.connected && !pageLoading && (
            <div style={{ margin: '8px 32px 0', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, border: '1px solid #d1dff7', background: '#eef3ff', padding: '8px 16px', flexShrink: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, lineHeight: 1, color: '#667085' }}>⚙</span>
              </div>
              <Text size="small">
                <span style={{ color: '#2D5BA3', fontSize: 14 }}>Finish your setup</span>
              </Text>
              <button
                onClick={handleConnectClick}
                disabled={connecting}
                style={{ marginLeft: 8, padding: '6px 16px', borderRadius: 50, border: `1px solid ${ZOHO_BLUE}`, background: '#fff', cursor: connecting ? 'not-allowed' : 'pointer', transition: 'background 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#dce9fb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
              >
                <Text size="small">
                  <span style={{ color: ZOHO_BLUE, fontSize: 13, fontWeight: 500 }}>
                    {connecting ? 'Connecting…' : 'Connect Your Zoho CRM Account'}
                  </span>
                </Text>
              </button>
            </div>
          )}

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'auto', background: '#f4f5f7' }}>
            {/* ── Dashboard ── */}
            {currentPage === 'dashboard' && (
              <div style={{ padding: '20px 32px', width: '100%', boxSizing: 'border-box' }}>
                <Layout>
                  {(
                    [
                      {
                        label: 'Contacts Synced',
                        value: statusLoading ? '—' : String(status?.contactsSynced ?? 0),
                        iconBg: '#eef3ff', iconColor: ZOHO_BLUE,
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>,
                      },
                      {
                        label: 'Sync Runs',
                        value: statusLoading ? '—' : String(syncLog.length ?? 0),
                        iconBg: '#f0faf3', iconColor: '#3ba755',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>,
                      },
                      {
                        label: 'Last Sync',
                        value: statusLoading ? '—' : relativeTime(status?.lastSyncAt ?? null),
                        iconBg: '#fff3ee', iconColor: '#FF7A59',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" /></svg>,
                      },
                      {
                        label: 'Zoho Org ID',
                        value: statusLoading ? '—' : status?.orgId ? String(status.orgId) : '—',
                        iconBg: '#f4f0ff', iconColor: '#7f56d9',
                        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" /></svg>,
                      },
                    ] as const
                  ).map((stat) => (
                    <Cell key={stat.label} span={3}>
                      <div style={{ height: '100%', borderRadius: 8, border: '1px solid #e8ecf1', overflow: 'hidden' }}>
                        <Card stretchVertically>
                          <Card.Content>
                            <Box direction="vertical" gap="SP4" paddingTop="SP2" paddingBottom="SP1">
                              <Box direction="horizontal" align="space-between" verticalAlign="middle">
                                <Text secondary size="small">{stat.label}</Text>
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: stat.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.iconColor, flexShrink: 0 }}>
                                  {stat.icon}
                                </div>
                              </Box>
                              <Text weight="bold" size="medium">{stat.value}</Text>
                            </Box>
                          </Card.Content>
                        </Card>
                      </div>
                    </Cell>
                  ))}

                  {/* Zoho CRM Connection card */}
                  <Cell span={12}>
                    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #c2d5f5', background: '#fff', boxShadow: '0 2px 12px 0 rgba(45,107,218,0.06)' }}>
                      {/* Header strip */}
                      <div style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1A3E5C 60%, #2D6BDA 100%)', padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 110, height: 52, borderRadius: 13, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backdropFilter: 'blur(4px)', padding: '0 14px' }}>
                          <span style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>Zoho CRM</span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.3, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                            Zoho CRM Connection
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: 400, lineHeight: 1.4, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                            Manage your Zoho CRM organisation integration
                          </span>
                        </div>
                        {!statusLoading && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', flexShrink: 0, backdropFilter: 'blur(4px)' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: status?.connected ? '#4ade80' : '#f87171', flexShrink: 0 }} />
                            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                              {status?.connected ? 'Connected' : 'Not Connected'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card body */}
                      <div style={{ padding: '24px 28px' }}>
                        {statusLoading ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
                            <Loader size="small" />
                          </div>
                        ) : status?.connected ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            {status.connectedAt && (
                              <Text size="small" secondary>
                                <span style={{ color: '#667085' }}>
                                  Connected since{' '}
                                  {new Date(status.connectedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </Text>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              <button
                                onClick={handleRegisterWebhook}
                                disabled={registeringWebhook}
                                title={status.channelId ? 'Re-register webhook channel' : 'Webhook not registered — click to enable real-time sync from Zoho'}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 8, border: `1.5px solid ${webhookRegistered ? '#3ba755' : status.channelId ? '#e8ecf1' : '#f59e0b'}`, background: webhookRegistered ? '#f0faf3' : '#fff', cursor: registeringWebhook ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease' }}
                              >
                                {registeringWebhook ? <Loader size="tiny" /> : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill={webhookRegistered ? '#3ba755' : status.channelId ? '#667085' : '#f59e0b'}>
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                  </svg>
                                )}
                                <Text size="small" weight="bold">
                                  <span style={{ color: webhookRegistered ? '#3ba755' : status.channelId ? '#667085' : '#b45309' }}>
                                    {webhookRegistered ? 'Webhook registered!' : status.channelId ? 'Re-register Webhook' : 'Register Webhook'}
                                  </span>
                                </Text>
                              </button>
                              <button
                                onClick={handleSync}
                                disabled={syncing}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 18px', borderRadius: 8, border: `1.5px solid ${ZOHO_BLUE}`, background: syncing ? '#eef3ff' : ZOHO_BLUE, cursor: syncing ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease' }}
                                onMouseEnter={(e) => { if (!syncing) e.currentTarget.style.background = '#1D5AC8'; }}
                                onMouseLeave={(e) => { if (!syncing) e.currentTarget.style.background = ZOHO_BLUE; }}
                              >
                                {syncing ? <Loader size="tiny" /> : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill={syncing ? ZOHO_BLUE : '#fff'} />
                                  </svg>
                                )}
                                <Text size="small" weight="bold">
                                  <span style={{ color: syncing ? ZOHO_BLUE : '#fff' }}>{syncLabel}</span>
                                </Text>
                              </button>
                              <button
                                onClick={handleDisconnect}
                                style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 18px', borderRadius: 8, border: '1.5px solid #fbc8c8', background: '#fff', cursor: 'pointer', transition: 'all 0.15s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#fff4f4'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                              >
                                <Text size="small" weight="bold">
                                  <span style={{ color: '#dc2626' }}>Disconnect</span>
                                </Text>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0 8px', gap: 12, textAlign: 'center' }}>
                            <div>
                              <Text size="medium" weight="bold">
                                <span style={{ color: '#101828' }}>Connect your Zoho CRM account</span>
                              </Text>
                              <Text size="small" secondary>
                                <span style={{ color: '#667085', display: 'block', marginTop: 4 }}>
                                  Sync contacts bidirectionally between Wix and Zoho CRM.
                                </span>
                              </Text>
                            </div>
                            <button
                              onClick={handleConnectClick}
                              style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 24px', borderRadius: 10, border: 'none', background: ZOHO_BLUE, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, boxShadow: '0 2px 8px rgba(45,107,218,0.3)', transition: 'all 0.15s ease' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#1D5AC8'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = ZOHO_BLUE; }}
                            >
                              Connect Zoho CRM
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Cell>
                </Layout>
                <MoreAppsByUs />
              </div>
            )}

            {/* Contacts tip banner */}
            {currentPage === 'contacts' && (
              <div style={{ margin: '12px 32px 0', padding: '12px 20px', borderRadius: 12, background: '#eef3ff', border: '1px solid #c2d5f5', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={ZOHO_BLUE}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                <Text size="small">
                  <span style={{ color: ZOHO_BLUE, fontWeight: 500 }}>
                    Next step: Map your fields so data stays in sync going forward.
                  </span>
                </Text>
                <button
                  onClick={() => setCurrentPage('fieldMapping')}
                  style={{ marginLeft: 8, padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${ZOHO_BLUE}`, background: '#fff', fontSize: 13, fontWeight: 600, color: ZOHO_BLUE, cursor: 'pointer' }}
                >
                  Map Fields →
                </button>
              </div>
            )}

            {currentPage === 'contacts' && (
              <ManageContactsPage orgId={status?.orgId?.toString()} upgradeUrl={upgradeUrl} contactLimit={contactLimit} onSyncComplete={fetchStatus} />
            )}
            {currentPage === 'fieldMapping' && (
              <FieldMappingPage
                editorUrl={editorUrl}
                onMappingsSaved={() => setFieldsMapped(true)}
                isPremium={isPremium}
                upgradeUrl={upgradeUrl}
              />
            )}
            {currentPage === 'plans' && (
              <PlansPage isPremium={isPremium} packageName={packageName} upgradeUrl={upgradeUrl} planPricing={planPricing} />
            )}
            {currentPage === 'support' && <SupportPage />}
          </div>
        </div>
      </div>

      {/* Contact limit modal */}
      {contactLimitData !== null && (
        <ContactLimitModal
          contactCount={contactLimitData.count}
          planLimit={contactLimitData.limit}
          skippedCount={contactLimitData.skippedCount}
          onUpgrade={() => { openUpgradeUrl(upgradeUrl); setContactLimitData(null); }}
          onClose={() => setContactLimitData(null)}
        />
      )}

      {/* Disconnect modal */}
      <Modal isOpen={showDisconnectModal} onRequestClose={() => !disconnecting && setShowDisconnectModal(false)} screen="desktop">
        <CustomModalLayout
          title="Disconnect Zoho CRM?"
          subtitle="Syncing will stop and your Zoho CRM connection will be removed. Your existing contacts are not deleted."
          primaryButtonText={disconnecting ? 'Disconnecting…' : 'Disconnect'}
          primaryButtonOnClick={confirmDisconnect}
          primaryButtonProps={{ disabled: disconnecting, skin: 'destructive', prefixIcon: disconnecting ? <Loader size="tiny" /> : undefined }}
          secondaryButtonText="Cancel"
          secondaryButtonOnClick={() => setShowDisconnectModal(false)}
          onCloseButtonClick={() => setShowDisconnectModal(false)}
          width="440px"
        />
      </Modal>

      {/* Pre-connect modal */}
      {showPreConnectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src="/zoho-logo.svg" alt="Zoho CRM" style={{ height: 24, width: 'auto' }} />
              </div>
              <Text size="medium" weight="bold">Connect your Zoho CRM account</Text>
            </div>
            <Text size="small">
              <span style={{ color: '#667085', lineHeight: 1.7, display: 'block' }}>
                You'll be redirected to Zoho to grant access. On the next screen, Zoho will ask you
                to confirm the permissions this app needs — this is a standard OAuth authorisation step.
              </span>
            </Text>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', background: ZOHO_BLUE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.7 : 1 }}
              >
                {connecting ? 'Connecting…' : 'Continue to Zoho CRM →'}
              </button>
              <button
                onClick={() => setShowPreConnectModal(false)}
                style={{ height: 42, padding: '0 18px', borderRadius: 10, border: '1.5px solid #e8ecf1', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#667085' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-connect modal */}
      {showPostConnectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3ba755">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
              <Text size="medium" weight="bold">Zoho CRM connected!</Text>
            </div>
            <Text size="small">
              <span style={{ color: '#667085', lineHeight: 1.7, display: 'block' }}>
                Your account is connected. Sync your data now to import your Zoho CRM contacts
                into Wix and see them in Manage Contacts.
              </span>
            </Text>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={handleSyncAndNavigate}
                disabled={syncing}
                style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', background: ZOHO_BLUE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1 }}
              >
                {syncing
                  ? syncStatus === 'running_phase1' ? 'Wix → Zoho…'
                  : syncStatus === 'running_phase2' ? 'Zoho → Wix…'
                  : 'Starting…'
                  : 'Sync Now →'}
              </button>
              <button
                onClick={() => setShowPostConnectModal(false)}
                style={{ height: 42, padding: '0 18px', borderRadius: 10, border: '1.5px solid #e8ecf1', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#667085' }}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

export default DashboardPage;
