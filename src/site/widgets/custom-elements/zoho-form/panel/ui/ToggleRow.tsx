import { type FC, useState } from 'react';
import { Box, Text, ToggleSwitch, Tooltip } from '@wix/design-system';
import { InfoCircleSmall } from '@wix/wix-ui-icons-common';
import PanelField from './PanelField';

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tooltip?: string;
  noDivider?: boolean;
}

const ToggleRow: FC<ToggleRowProps> = ({ label, checked, onChange, tooltip, noDivider }) => {
  const [iconHovered, setIconHovered] = useState(false);

  return (
    <PanelField noDivider={noDivider}>
      <Box direction="vertical" gap="SP2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text size="small">{label}</Text>
          {tooltip && (
            <Tooltip content={tooltip} appendTo="window" maxWidth={220}>
              <span
                style={{ display: 'flex', alignItems: 'center', cursor: 'default', color: iconHovered ? '#2D6BDA' : '#999' }}
                onMouseEnter={() => setIconHovered(true)}
                onMouseLeave={() => setIconHovered(false)}
              >
                <InfoCircleSmall />
              </span>
            </Tooltip>
          )}
        </div>
        <ToggleSwitch
          size="medium"
          checked={checked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
      </Box>
    </PanelField>
  );
};

export default ToggleRow;
