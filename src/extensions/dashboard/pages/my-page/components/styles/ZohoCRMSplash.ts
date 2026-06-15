import type { CSSProperties } from 'react';

export const s = {
  overlay: (fullScreen: boolean): CSSProperties => ({
    position: fullScreen ? 'fixed' : 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(145deg, #0A2540 0%, #1A3E5C 55%, #2D6BDA 100%)',
    zIndex: fullScreen ? 9999 : 10,
  }),

  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  } as CSSProperties,

  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.5px',
    lineHeight: 1,
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  } as CSSProperties,

  logoSub: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  } as CSSProperties,

  progressTrack: {
    marginTop: 28,
    height: 6,
    width: 220,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  } as CSSProperties,

  progressBar: {
    height: '100%',
    width: '38%',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.75)',
  } as CSSProperties,

  statusText: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  } as CSSProperties,
};
