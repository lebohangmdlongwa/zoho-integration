import type { CSSProperties } from 'react';

export const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    border: '1px solid #E5E5E5',
    borderRadius: '8px',
    flex: 1,
    minWidth: 0,
  } as CSSProperties,
  image: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    objectFit: 'cover',
  } as CSSProperties,
  descriptionWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    textAlign: 'center',
  } as CSSProperties,
};
