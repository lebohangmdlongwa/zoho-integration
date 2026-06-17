import type { CSSProperties } from 'react';

const WIX_FONT = "'Madefor Display', 'Helvetica Neue', sans-serif";

export const s = {
  page: {
    padding: '20px 24px',
    background: '#f4f5f7',
    minHeight: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as CSSProperties,

  statsRow: {
    display: 'flex',
    gap: 12,
  } as CSSProperties,

  statCard: {
    flex: 1,
    background: '#fff',
    border: '1px solid #e8ecf1',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as CSSProperties,

  statLabel: {
    fontSize: 11,
    color: '#667085',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontWeight: 500,
    fontFamily: WIX_FONT,
  } as CSSProperties,

  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#101828',
    letterSpacing: '-0.5px',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e8ecf1',
    overflow: 'hidden',
  } as CSSProperties,

  cardHeader: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e8ecf1',
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
    fontSize: 13,
    fontWeight: 500,
    fontFamily: WIX_FONT,
    flexShrink: 0,
    transition: 'opacity 0.15s ease',
  }),

  tableScroll: {
    overflowX: 'auto' as const,
  } as CSSProperties,

  thead: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1.8fr 1fr 1.4fr',
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
    fontWeight: 600,
    fontFamily: WIX_FONT,
  } as CSSProperties,

  trow: (isLast: boolean, clickable = false): CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1.8fr 1fr 1.4fr',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: isLast ? 'none' : '1px solid #f2f4f7',
    cursor: clickable ? 'pointer' : 'default',
    transition: 'background 0.1s ease',
  }),

  dealNameCell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 0,
  } as CSSProperties,

  dealName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#101828',
    fontFamily: WIX_FONT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  dealId: {
    fontSize: 10,
    color: '#9aa5b4',
    fontFamily: WIX_FONT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  stageBadge: (color: string, bg: string): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifySelf: 'start',
    padding: '3px 10px',
    borderRadius: 50,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: WIX_FONT,
    color,
    background: bg,
    whiteSpace: 'nowrap' as const,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),

  amount: {
    fontSize: 13,
    fontWeight: 600,
    color: '#101828',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  date: {
    fontSize: 12,
    color: '#667085',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  contact: {
    fontSize: 12,
    color: '#344054',
    fontFamily: WIX_FONT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid #e8ecf1',
  } as CSSProperties,

  loadMoreBtn: (disabled: boolean): CSSProperties => ({
    height: 32,
    padding: '0 16px',
    border: '1px solid #e8ecf1',
    borderRadius: 50,
    background: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: 12,
    color: '#344054',
    fontFamily: WIX_FONT,
  }),

  emptyWrap: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  } as CSSProperties,

  emptyIcon: {
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
