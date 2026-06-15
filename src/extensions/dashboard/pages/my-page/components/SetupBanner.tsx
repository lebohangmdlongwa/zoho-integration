import type { FC } from 'react';
import { Box, Text } from '@wix/design-system';
import { s } from './styles/SetupBanner';

interface SetupBannerProps {
  onConnect: () => void;
  connecting: boolean;
}

const SetupBanner: FC<SetupBannerProps> = ({ onConnect, connecting }) => {
  return (
    <div style={s.banner}>
      <div style={s.warningCircle}>
        <Text size="tiny" weight="bold" light>
          !
        </Text>
      </div>

      <Box flex="1">
        <Text size="small" weight="bold">
          Finish your setup
        </Text>
      </Box>

      <button
        onClick={onConnect}
        disabled={connecting}
        style={s.ctaBtn(connecting)}
      >
        <Text size="small" weight="bold">
          {connecting ? 'Connecting…' : 'Connect Your Zoho CRM Account'}
        </Text>
      </button>
    </div>
  );
};

export default SetupBanner;
