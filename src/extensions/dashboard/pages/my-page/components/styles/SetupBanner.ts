import type { CSSProperties } from 'react';

export const s = {
  banner: {
    background: '#fffbeb',
    borderBottom: '1px solid #fde68a',
    padding: '10px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  } as CSSProperties,

  warningCircle: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as CSSProperties,

  ctaBtn: (connecting: boolean): CSSProperties => ({
    padding: '6px 18px',
    border: '1px solid #d97706',
    borderRadius: 6,
    background: 'transparent',
    cursor: connecting ? 'not-allowed' : 'pointer',
    opacity: connecting ? 0.7 : 1,
    whiteSpace: 'nowrap',
  }),
};
