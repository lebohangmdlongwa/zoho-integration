import type { FC } from 'react';
import { Text } from '@wix/design-system';
import { s } from './styles/ZohoCRMSplash';

const ZohoCRMSplash: FC<{ fullScreen?: boolean }> = ({ fullScreen = false }) => (
  <div style={s.overlay(fullScreen)}>
    <style>{`
      @keyframes zoho-splash-slide {
        0%   { transform: translateX(-115%); opacity: 0.5; }
        50%  { transform: translateX(85%);   opacity: 1;   }
        100% { transform: translateX(260%);  opacity: 0.5; }
      }
      .zoho-splash-bar { animation: zoho-splash-slide 1.15s ease-in-out infinite; }
    `}</style>

    <div style={s.inner}>
      <img src="/zoho-logo.svg" alt="Zoho CRM" style={{ height: 52, width: 'auto' }} />

      <div style={{ marginTop: 10 }}>
        <Text size="tiny">
          <span style={s.logoSub}>Integration</span>
        </Text>
      </div>

      <div style={s.progressTrack}>
        <div className="zoho-splash-bar" style={s.progressBar} />
      </div>

      <div style={{ marginTop: 14 }}>
        <Text size="small">
          <span style={s.statusText}>Preparing your workspace</span>
        </Text>
      </div>
    </div>
  </div>
);

export default ZohoCRMSplash;
