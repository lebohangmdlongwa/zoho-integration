import type { FC } from 'react';
import { Box, Divider } from '@wix/design-system';
import ColorPickerField from '../ColorPickerField';
import SliderField from '../SliderField';
import ToggleRow from '../ToggleRow';

interface Props {
  cBgColor: string;
  onCBgColorChange: (v: string) => void;
  cUseGradient: boolean;
  onCUseGradientChange: (v: boolean) => void;
  cGradEnd: string;
  onCGradEndChange: (v: string) => void;
  cFontSize: number;
  onCFontSizeChange: (v: number) => void;
  cWidth: number;
  onCWidthChange: (v: number) => void;
  cBorderRadius: number;
  onCBorderRadiusChange: (v: number) => void;
  cBorderWidth: number;
  onCBorderWidthChange: (v: number) => void;
  headerTextColor: string;
  onHeaderTextColorChange: (v: string) => void;
}

const CompressedTab: FC<Props> = ({
  cBgColor, onCBgColorChange,
  cUseGradient, onCUseGradientChange,
  cGradEnd, onCGradEndChange,
  cFontSize, onCFontSizeChange,
  cWidth, onCWidthChange,
  cBorderRadius, onCBorderRadiusChange,
  cBorderWidth, onCBorderWidthChange,
  headerTextColor, onHeaderTextColorChange,
}) => (
  <Box direction="vertical">
    <ColorPickerField label="Background colour" value={cBgColor} onChange={onCBgColorChange} />
    <ColorPickerField label="Text colour" value={headerTextColor} onChange={onHeaderTextColorChange} />

    <Divider />

    <ToggleRow
      label="Use gradient"
      checked={cUseGradient}
      onChange={onCUseGradientChange}
      tooltip="Blends the pill background from the background colour to a second colour."
    />
    {cUseGradient && (
      <ColorPickerField label="Gradient end colour" value={cGradEnd} onChange={onCGradEndChange} />
    )}

    <Divider />

    <SliderField label="Font size" value={cFontSize} min={8} max={20} onChange={onCFontSizeChange} tooltip="Size of the text inside the compact pill." />
    <SliderField label="Width" value={cWidth} min={100} max={600} onChange={onCWidthChange} tooltip="Maximum width of the compact pill in pixels." />
    <SliderField label="Border radius" value={cBorderRadius} min={0} max={32} onChange={onCBorderRadiusChange} tooltip="Roundness of the compact pill corners." />
    <SliderField label="Border width" value={cBorderWidth} min={0} max={6} onChange={onCBorderWidthChange} tooltip="Thickness of the pill outline. Set to 0 to remove it." />
  </Box>
);

export default CompressedTab;
