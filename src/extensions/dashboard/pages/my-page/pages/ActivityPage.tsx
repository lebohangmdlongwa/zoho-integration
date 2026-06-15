import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { httpClient } from '@wix/essentials';
import {
  Badge,
  Box,
  Card,
  Cell,
  EmptyState,
  Layout,
  Loader,
  Text,
} from '@wix/design-system';

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

const SuccessIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#3ba755">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#d63b3b">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const SkippedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#667085">
    <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </svg>
);

const statusConfig = {
  success: { bg: '#f0faf3', border: '#b6e6c3', iconBg: '#dcf5e3' },
  error: { bg: '#fff5f5', border: '#f9c0c0', iconBg: '#fde0e0' },
  skipped: { bg: '#f9fafb', border: '#e4e7ec', iconBg: '#eef0f4' },
};

const ActivityPage: FC = () => {
  const [entries, setEntries] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await httpClient
        .fetchWithAuth('/api/zoho/sync-log')
        .then((r) => r.json());
      setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const successCount = entries.filter((e) => e.status === 'success').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;
  const skippedCount = entries.filter((e) => e.status === 'skipped').length;

  const stats = [
    { label: 'Successful', value: successCount, color: '#3ba755', bg: '#f0faf3' },
    { label: 'Errors', value: errorCount, color: '#d63b3b', bg: '#fff5f5' },
    { label: 'Skipped', value: skippedCount, color: '#667085', bg: '#f4f5f7' },
    { label: 'Total', value: entries.length, color: '#FF7A59', bg: '#fff3ee' },
  ];

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
        {stats.map((s) => (
          <Cell key={s.label} span={3}>
            <div
              style={{
                background: s.bg,
                border: `1px solid ${s.color}22`,
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <Text size="small" secondary>{s.label}</Text>
              <Text weight="bold" size="medium">
                <span style={{ color: s.color, fontSize: 26, fontWeight: 700 }}>
                  {s.value}
                </span>
              </Text>
            </div>
          </Cell>
        ))}

        <Cell span={12}>
          <Card>
            <Card.Header
              title="Sync Timeline"
              subtitle="All contact sync events, most recent first"
              suffix={
                <button
                  onClick={fetchEntries}
                  disabled={loading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    border: '1px solid #e8ecf1',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    color: '#667085',
                  }}
                >
                  <RefreshIcon />
                  <Text size="small">
                    <span style={{ color: '#667085' }}>Refresh</span>
                  </Text>
                </button>
              }
            />
            <Card.Divider />
            <Card.Content>
              {loading ? (
                <Box padding="SP8" align="center">
                  <Loader size="small" />
                </Box>
              ) : entries.length === 0 ? (
                <EmptyState
                  skin="page"
                  title="No activity yet"
                  subtitle="Connect Zoho CRM and trigger a sync to see activity here."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {entries.map((entry, idx) => {
                    const cfg =
                      statusConfig[entry.status as keyof typeof statusConfig] ??
                      statusConfig.skipped;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          gap: 14,
                          padding: '14px 0',
                          borderBottom:
                            idx < entries.length - 1
                              ? '1px solid #f0f4f7'
                              : 'none',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: cfg.iconBg,
                            border: `1px solid ${cfg.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        >
                          {entry.status === 'success' ? (
                            <SuccessIcon />
                          ) : entry.status === 'error' ? (
                            <ErrorIcon />
                          ) : (
                            <SkippedIcon />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <Text size="small" weight="bold">
                              <span style={{ textTransform: 'capitalize' }}>
                                {entry.direction.replace(/_/g, ' ')}
                              </span>
                            </Text>
                            <Badge
                              skin={
                                entry.status === 'success'
                                  ? 'success'
                                  : entry.status === 'skipped'
                                    ? 'neutral'
                                    : 'danger'
                              }
                            >
                              {entry.status}
                            </Badge>
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {entry.zoho_id && (
                              <Text size="tiny" secondary>
                                Zoho ID: {entry.zoho_id}
                              </Text>
                            )}
                            {entry.skip_reason && (
                              <Text size="tiny" secondary>
                                Skipped: {entry.skip_reason}
                              </Text>
                            )}
                            {entry.error_message && (
                              <Text size="tiny" skin="error">
                                {entry.error_message}
                              </Text>
                            )}
                          </div>
                        </div>

                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                          <Text size="tiny" secondary>
                            {relativeTime(entry.synced_at)}
                          </Text>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Content>
          </Card>
        </Cell>
      </Layout>
    </div>
  );
};

export default ActivityPage;
