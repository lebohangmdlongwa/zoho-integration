import type { FC } from 'react';
import { inputs } from '@wix/editor';
import { Box, Text, FillPreview } from '@wix/design-system';
import PanelField from './PanelField';

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorPickerField: FC<ColorPickerFieldProps> = ({ label, value, onChange }) => (
  <PanelField noDivider>
    <Box align="space-between" verticalAlign="middle">
      <Box direction="vertical" gap="2px">
        <Text size="small">{label}</Text>
        <Text size="tiny" secondary>{value}</Text>
      </Box>
      <div
        style={{
          width: 38, height: 38, borderRadius: 8, overflow: 'hidden',
          cursor: 'pointer', border: '1.5px solid rgba(0,0,0,0.14)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)', flexShrink: 0,
        }}
        onClick={() => inputs.selectColor(value, { onChange: (v) => { if (v) onChange(v); } })}
      >
        <FillPreview fill={value} />
      </div>
    </Box>
  </PanelField>
);

export default ColorPickerField;
