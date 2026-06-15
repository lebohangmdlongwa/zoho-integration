import type { CSSProperties } from 'react';

export const styles = {
  appsGrid: {
    display: 'flex',
    gap: '24px',
    alignItems: 'stretch',
  } as CSSProperties,
  poweredByRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as CSSProperties,
  exploreLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#2D6BDA',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    fontFamily:
      'HelveticaNeueW01-55Roma, HelveticaNeueW02-55Roma, HelveticaNeueW10-55Roma, Helvetica Neue, Helvetica, Arial, sans-serif',
    letterSpacing: '0.2px',
  } as CSSProperties,
  poweredByText: {
    fontSize: '10px',
    color: '#aaa',
    letterSpacing: '1.2px',
    lineHeight: 1,
    fontFamily:
      'HelveticaNeueW01-55Roma, HelveticaNeueW02-55Roma, HelveticaNeueW10-55Roma, Helvetica Neue, Helvetica, Arial, sans-serif',
    fontWeight: 500,
    textTransform: 'uppercase',
  } as CSSProperties,
  poweredByLogo: {
    height: 20,
    display: 'block',
  } as CSSProperties,
};
