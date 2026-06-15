import { type FC, useState } from 'react';
import { s } from './styles/ContactLimitModal';

type Props = {
  contactCount: number;
  planLimit: number;
  onUpgrade: () => void;
  onClose: () => void;
  skippedCount?: number;
};

const UPGRADE_FEATURES = [
  'Sync unlimited contacts bidirectionally',
  'Automatic field mapping across all contact fields',
  'Real-time webhook sync on every contact change',
  'Priority support',
];

const ContactLimitModal: FC<Props> = ({
  contactCount,
  planLimit,
  onUpgrade,
  onClose,
  skippedCount,
}) => {
  const isSkippedVariant = skippedCount !== undefined && skippedCount > 0;
  const [upgradeHovered, setUpgradeHovered] = useState(false);
  const [laterHovered, setLaterHovered] = useState(false);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={s.header}>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>

          {!isSkippedVariant && (
            <div style={s.iconRing}>
              <LockIcon />
            </div>
          )}

          <p style={s.headerLabel}>
            {isSkippedVariant ? 'Sync Partially Completed' : 'Plan Limit Reached'}
          </p>
          <h2 style={s.headerTitle}>
            {isSkippedVariant ? 'Some Contacts Were Skipped' : 'Unlock Full Contact Sync'}
          </h2>

          {isSkippedVariant ? (
            <>
              <div style={s.statRow}>
                <div style={s.statPill}>
                  <span style={s.statCheck}>✓</span>
                  <span style={s.statText}>
                    <strong>{planLimit.toLocaleString()}</strong> synced
                  </span>
                </div>
                <div style={{ ...s.statPill, background: 'rgba(0,0,0,0.18)' }}>
                  <span style={s.statSkip}>✕</span>
                  <span style={s.statText}>
                    <strong>{skippedCount!.toLocaleString()}</strong> skipped
                  </span>
                </div>
              </div>
              <p style={{ ...s.headerSub, marginTop: 12 }}>
                Your plan supports up to{' '}
                <strong style={{ color: '#fff' }}>{planLimit.toLocaleString()} contacts</strong>.
                {' '}Upgrade to sync all of them.
              </p>
            </>
          ) : (
            <p style={s.headerSub}>
              Your account has{' '}
              <strong style={{ color: '#fff' }}>{contactCount.toLocaleString()} contacts</strong>
              {' '}— your current plan supports up to{' '}
              <strong style={{ color: '#fff' }}>{planLimit.toLocaleString()} contacts</strong>.
            </p>
          )}
        </div>

        {/* ── Body ── */}
        <div style={s.body}>
          <p style={s.featuresLabel}>Everything included with a higher plan:</p>
          <ul style={s.featureList}>
            {UPGRADE_FEATURES.map((f) => (
              <li key={f} style={s.featureItem}>
                <span style={s.checkMark}>✓</span>
                <span style={s.featureText}>{f}</span>
              </li>
            ))}
          </ul>

          <button
            style={{ ...s.upgradeBtn, ...(upgradeHovered ? s.upgradeBtnHover : {}) }}
            onClick={onUpgrade}
            onMouseEnter={() => setUpgradeHovered(true)}
            onMouseLeave={() => setUpgradeHovered(false)}
          >
            <StarIcon />
            Upgrade Plan
          </button>

          <button
            style={{ ...s.laterBtn, ...(laterHovered ? s.laterBtnHover : {}) }}
            onClick={onClose}
            onMouseEnter={() => setLaterHovered(true)}
            onMouseLeave={() => setLaterHovered(false)}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

const LockIcon: FC = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </svg>
);

const StarIcon: FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default ContactLimitModal;
