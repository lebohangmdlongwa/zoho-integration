import type { CSSProperties } from 'react';

export const s = {
  // ── Layout ───────────────────────────────────────────────────────
  page: {
    padding: '20px 24px',
    background: '#f4f5f7',
    minHeight: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as CSSProperties,

  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e8ecf1',
    overflow: 'hidden',
  } as CSSProperties,

  cardHeader: {
    padding: '16px 20px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as CSSProperties,

  // ── Toolbar ──────────────────────────────────────────────────────
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 20px',
    borderBottom: '1px solid #e8ecf1',
  } as CSSProperties,

  filterRow: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  } as CSSProperties,

  filterBtn: (active: boolean): CSSProperties => ({
    height: 34,
    padding: '0 14px',
    border: `1px solid ${active ? '#2D6BDA' : '#e8ecf1'}`,
    borderRadius: 50,
    background: active ? '#2D6BDA' : '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
  }),

  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 14px',
    height: 38,
    border: '1px solid #e8ecf1',
    borderRadius: 50,
    background: '#f9fafb',
    boxSizing: 'border-box',
  } as CSSProperties,

  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 13,
    color: '#344054',
    background: 'transparent',
  } as CSSProperties,

  syncBtn: (syncing: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 36,
    padding: '0 16px',
    border: 'none',
    borderRadius: 50,
    background: syncing ? '#90aee8' : '#2D6BDA',
    color: '#fff',
    cursor: syncing ? 'not-allowed' : 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s ease',
  }),

  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    border: '1px solid #e8ecf1',
    borderRadius: '50%',
    background: '#fff',
    cursor: 'pointer',
    color: '#667085',
    flexShrink: 0,
    transition: 'background 0.15s ease',
  } as CSSProperties,

  // ── Table ────────────────────────────────────────────────────────
  tableScroll: {
    maxHeight: 480,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#e8ecf1 transparent',
  } as CSSProperties,

  thead: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#f9fafb',
    borderBottom: '1px solid #e8ecf1',
  } as CSSProperties,

  theadLabel: {
    color: '#667085',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontSize: 11,
  } as CSSProperties,

  trow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #f2f4f7',
    transition: 'background 0.12s ease',
    cursor: 'default',
  } as CSSProperties,

  contactCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  } as CSSProperties,

  avatar: (bg: string): CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),

  contactName: {
    color: '#101828',
    fontWeight: 500,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  contactEmail: {
    color: '#9aa5b4',
    fontSize: 10,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  hsIdLink: {
    color: '#2D6BDA',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  } as CSSProperties,

  // ── Footer / pagination ──────────────────────────────────────────
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid #e8ecf1',
    background: '#fff',
  } as CSSProperties,

  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as CSSProperties,

  activityPaginationBtn: (disabled: boolean): CSSProperties => ({
    height: 30,
    padding: '0 12px',
    border: '1px solid #e8ecf1',
    borderRadius: 50,
    background: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }),

  // ── Activity section ─────────────────────────────────────────────
  activitySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } as CSSProperties,

  sectionHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  } as CSSProperties,

  totalSyncedCard: {
    background: '#EEF3FF',
    border: '1px solid #2D6BDA22',
    borderRadius: 10,
    padding: '12px 20px',
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 2,
    alignSelf: 'flex-start',
  } as CSSProperties,

  activityEmpty: {
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  } as CSSProperties,

  activityRow: (isLast: boolean): CSSProperties => ({
    display: 'flex',
    gap: 14,
    padding: '12px 20px',
    borderBottom: isLast ? 'none' : '1px solid #f0f4f7',
  }),

  activityIcon: (iconBg: string, border: string): CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: iconBg,
    border: `1px solid ${border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  }),

  activityContent: {
    flex: 1,
    minWidth: 0,
  } as CSSProperties,

  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  } as CSSProperties,

  activityMeta: {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap' as const,
  } as CSSProperties,

  activityTime: {
    flexShrink: 0,
    paddingTop: 2,
  } as CSSProperties,

  // ── Empty state ──────────────────────────────────────────────────
  emptyContactsWrap: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  } as CSSProperties,

  emptyContactsIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#EEF3FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2D6BDA',
  } as CSSProperties,
};
