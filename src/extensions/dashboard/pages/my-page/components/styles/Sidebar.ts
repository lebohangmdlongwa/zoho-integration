import type { CSSProperties } from 'react';

export const s = {
  sidebar: (expanded: boolean): CSSProperties => ({
    width: expanded ? 220 : 60,
    minWidth: expanded ? 220 : 60,
    height: '100vh',
    background: '#ffffff',
    borderRight: '1px solid #e8ecf1',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease, min-width 0.2s ease',
    overflow: 'hidden',
    flexShrink: 0,
  }),

  brandHeader: {
    minHeight: 72,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 0,
  } as CSSProperties,

  logoText: (expanded: boolean): CSSProperties => ({
    fontSize: expanded ? 16 : 11,
    fontWeight: 800,
    color: '#2D6BDA',
    letterSpacing: expanded ? '-0.3px' : '0px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  }),

  nav: {
    flex: 1,
    padding: '10px 16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as CSSProperties,

  navBtn: (expanded: boolean, isActive: boolean): CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: expanded ? '9px 12px' : '9px 0',
    justifyContent: expanded ? 'flex-start' : 'center',
    border: 'none',
    borderRadius: 10,
    background: isActive ? '#EEF3FF' : 'transparent',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  }),

  navIcon: (isActive: boolean): CSSProperties => ({
    flexShrink: 0,
    display: 'flex',
    color: isActive ? '#2D6BDA' : '#667085',
  }),

  navLabel: (isActive: boolean): CSSProperties => ({
    color: isActive ? '#2D6BDA' : '#344054',
    fontWeight: isActive ? 500 : 400,
  }),

  settingsDividerRow: {
    marginTop: 12,
    marginBottom: 4,
  } as CSSProperties,

  settingsLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 4px',
  } as CSSProperties,

  settingsLabel: {
    color: '#9ca3af',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    fontSize: 10,
  } as CSSProperties,

  settingsDividerLine: {
    flex: 1,
    height: 1,
    background: '#e8ecf1',
  } as CSSProperties,

  settingsDividerLineCollapsed: {
    height: 1,
    background: '#e8ecf1',
    margin: '0 8px',
  } as CSSProperties,

  statusBadge: {
    padding: '12px 14px',
    borderTop: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as CSSProperties,

  statusBadgeCollapsed: {
    padding: '12px 8px',
    borderTop: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as CSSProperties,

  statusPill: (isConnected: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: isConnected ? '#3ba755' : '#2D6BDA',
    borderRadius: 20,
    padding: '5px 12px',
    width: '100%',
    justifyContent: 'center',
  }),

  statusDot: (isConnected: boolean): CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: isConnected ? '#3ba755' : '#2D6BDA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  }),

  statusText: {
    color: '#fff',
    fontWeight: 600,
    letterSpacing: '0.2px',
  } as CSSProperties,

  toggleRow: {
    padding: '6px 8px',
    borderTop: '1px solid #e8ecf1',
    flexShrink: 0,
  } as CSSProperties,

  toggleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
    color: '#667085',
  } as CSSProperties,
};
