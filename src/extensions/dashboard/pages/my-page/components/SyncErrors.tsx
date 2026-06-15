import type { FC } from 'react';
import { useState } from 'react';
import { Box, Loader, Text } from '@wix/design-system';
import { s } from './styles/SyncErrors';

interface SyncErrorEntry {
  zoho_id: string | null;
  wix_id: string | null;
  direction: string;
  error_message: string | null;
  synced_at: string;
}

interface SyncErrorRun {
  sync_id: string;
  synced_at: string;
  count: number;
  entries: SyncErrorEntry[];
}

interface SyncErrorsProps {
  runs: SyncErrorRun[];
  loading: boolean;
  onRefresh: () => void;
}

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

const ErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#d63b3b">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </svg>
);

export const SyncErrors: FC<SyncErrorsProps> = ({ runs, loading, onRefresh }) => {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (!loading && runs.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Text size="medium" weight="bold">
          <span style={{ color: '#d63b3b' }}>Sync Errors</span>
        </Text>
        <div style={{ flex: 1, height: 1, background: '#fbc8c8' }} />
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh errors"
          style={s.iconBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fff0f0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
        >
          <RefreshIcon />
        </button>
      </div>

      {loading ? (
        <Box padding="SP4" align="center"><Loader size="small" /></Box>
      ) : (
        runs.map((run) => (
          <div key={run.sync_id} style={s.card}>
            <button
              onClick={() => setExpandedRun(expandedRun === run.sync_id ? null : run.sync_id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fde0e0', border: '1px solid #f9c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ErrorIcon />
              </div>
              <div style={{ flex: 1 }}>
                <Text size="small" weight="bold">
                  <span style={{ color: '#d63b3b' }}>{run.count} error{run.count !== 1 ? 's' : ''}</span>
                  <span style={{ color: '#667085', fontWeight: 400 }}> — {relativeTime(run.synced_at)}</span>
                </Text>
              </div>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{expandedRun === run.sync_id ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {expandedRun === run.sync_id && (
              <div style={{ borderTop: '1px solid #fbc8c8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, padding: '8px 20px', background: '#fff8f8' }}>
                  {['Zoho ID', 'Direction', 'Error'].map((h) => (
                    <Text key={h} size="tiny" weight="bold">
                      <span style={{ color: '#667085', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px' }}>{h}</span>
                    </Text>
                  ))}
                </div>
                {run.entries.map((e, i) => (
                  <div
                    key={i}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, padding: '10px 20px', borderTop: '1px solid #fde8e8', alignItems: 'flex-start' }}
                  >
                    <Text size="tiny">
                      <span style={{ color: '#344054', fontFamily: 'monospace' }}>{e.zoho_id ?? e.wix_id ?? '—'}</span>
                    </Text>
                    <Text size="tiny" secondary>
                      <span style={{ color: '#667085' }}>{e.direction.replace(/_/g, ' ')}</span>
                    </Text>
                    <Text size="tiny" skin="error">
                      <span style={{ color: '#d63b3b', wordBreak: 'break-word' }}>{e.error_message ?? '—'}</span>
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
