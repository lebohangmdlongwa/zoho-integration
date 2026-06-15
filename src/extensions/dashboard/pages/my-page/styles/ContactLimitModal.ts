import type { CSSProperties } from 'react';

const WIX_FONT = "'Madefor Display', 'Helvetica Neue', sans-serif";

export const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '24px',
  } as CSSProperties,

  card: {
    width: '100%',
    maxWidth: '440px',
    borderRadius: '24px',
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 32px 80px rgba(0, 0, 0, 0.28)',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  header: {
    background: 'linear-gradient(135deg, #FF7A59 0%, #F05C35 50%, #d94820 100%)',
    padding: '40px 32px 36px',
    textAlign: 'center',
    position: 'relative',
  } as CSSProperties,

  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  } as CSSProperties,

  iconRing: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(8px)',
    border: '2px solid rgba(255,255,255,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  } as CSSProperties,

  headerLabel: {
    margin: '0 0 8px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  headerTitle: {
    margin: '0 0 12px',
    fontSize: '26px',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
    fontFamily: WIX_FONT,
  } as CSSProperties,

  headerSub: {
    margin: 0,
    fontSize: '14px',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.6,
    fontFamily: WIX_FONT,
  } as CSSProperties,

  body: {
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
  } as CSSProperties,

  featuresLabel: {
    margin: '0 0 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  featureList: {
    listStyle: 'none',
    margin: '0 0 28px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } as CSSProperties,

  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  } as CSSProperties,

  checkMark: {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #FF7A59, #F05C35)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '1px',
  } as CSSProperties,

  featureText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.5,
    fontFamily: WIX_FONT,
  } as CSSProperties,

  upgradeBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #FF7A59 0%, #F05C35 100%)',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '12px',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    boxShadow: '0 4px 16px rgba(255, 122, 89, 0.4)',
    fontFamily: WIX_FONT,
  } as CSSProperties,

  upgradeBtnHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(255, 122, 89, 0.5)',
  } as CSSProperties,

  laterBtn: {
    width: '100%',
    padding: '12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: '#9ca3af',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: WIX_FONT,
    transition: 'color 0.15s ease',
  } as CSSProperties,

  laterBtnHover: {
    color: '#6b7280',
  } as CSSProperties,

  statRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  } as CSSProperties,

  statPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.18)',
    borderRadius: 50,
    padding: '8px 18px',
  } as CSSProperties,

  statCheck: {
    fontSize: 14,
    fontWeight: 700,
    color: '#d4f7e0',
  } as CSSProperties,

  statSkip: {
    fontSize: 13,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
  } as CSSProperties,

  statText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: WIX_FONT,
  } as CSSProperties,
};
