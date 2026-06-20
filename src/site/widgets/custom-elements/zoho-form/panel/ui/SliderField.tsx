import { type FC, useState } from 'react';
import { Box, Text, Tooltip } from '@wix/design-system';
import { InfoCircleSmall } from '@wix/wix-ui-icons-common';
import PanelField from './PanelField';

const ZOHO_BLUE = '#2D6BDA';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  tooltip?: string;
  onChange: (v: number) => void;
}

const SliderField: FC<SliderFieldProps> = ({
  label, value, min, max, unit = 'px', tooltip, onChange,
}) => {
  const [iconHovered, setIconHovered] = useState(false);

  return (
    <PanelField noDivider>
      <Box align="space-between" marginBottom="SP1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text size="small">{label}</Text>
          {tooltip && (
            <Tooltip content={tooltip} appendTo="window" maxWidth={220}>
              <span
                style={{ display: 'flex', alignItems: 'center', cursor: 'default', color: iconHovered ? ZOHO_BLUE : '#999' }}
                onMouseEnter={() => setIconHovered(true)}
                onMouseLeave={() => setIconHovered(false)}
              >
                <InfoCircleSmall />
              </span>
            </Tooltip>
          )}
        </div>
        <Text size="small" secondary>{value}{unit}</Text>
      </Box>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: ZOHO_BLUE, cursor: 'pointer' }}
      />
    </PanelField>
  );
};

export default SliderField;
