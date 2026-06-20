import type { CSSProperties } from 'react';

export const styles = {
  stickyWrapper: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: '#fff',
    padding: '10px 12px 8px',
  } as CSSProperties,
  container: {
    display: 'flex',
    background: '#EBEBEC',
    borderRadius: '10px',
    padding: '3px',
    gap: '2px',
  } as CSSProperties,
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    padding: '6px 2px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  } as CSSProperties,
  tabActive: {
    background: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.08)',
  } as CSSProperties,
  label: {
    fontSize: '7px',
    fontWeight: 600,
    letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
    lineHeight: 1,
  } as CSSProperties,
};
