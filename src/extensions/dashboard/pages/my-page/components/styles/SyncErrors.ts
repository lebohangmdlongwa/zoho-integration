import type { CSSProperties } from 'react';

export const s = {
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #fbc8c8',
    overflow: 'hidden',
  } as CSSProperties,

  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: '1px solid #e8ecf1',
    borderRadius: '50%',
    background: '#fff',
    cursor: 'pointer',
    color: '#667085',
    flexShrink: 0,
    transition: 'background 0.15s ease',
  } as CSSProperties,
};
