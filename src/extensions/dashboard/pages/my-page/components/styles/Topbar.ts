import type { CSSProperties } from 'react';

export const s = {
  bar: {
    height: 72,
    minHeight: 72,
    background: '#ffffff',
    borderBottom: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    padding: '0 32px',
    flexShrink: 0,
    position: 'relative',
  } as CSSProperties,

  titleWrap: {
    flex: 1,
  } as CSSProperties,

  titleText: {
    fontSize: 28,
    fontWeight: 600,
    color: '#101828',
    letterSpacing: '-0.2px',
  } as CSSProperties,

  centerLockup: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    userSelect: 'none',
  } as CSSProperties,

  actionsWrap: {
    flex: 1,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  } as CSSProperties,

  editorBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 16px',
    borderRadius: 17,
    border: '1px solid #d0d5dd',
    background: '#f8f9fc',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as CSSProperties,

  upgradeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 16px',
    borderRadius: 17,
    border: '1px solid #d0d5dd',
    background: '#f8f9fc',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as CSSProperties,
};
