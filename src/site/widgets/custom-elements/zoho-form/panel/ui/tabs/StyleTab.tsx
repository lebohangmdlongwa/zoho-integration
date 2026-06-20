import type { FC } from 'react';
import { Box, Divider } from '@wix/design-system';
import ColorPickerField from '../ColorPickerField';
import SliderField from '../SliderField';
import ToggleRow from '../ToggleRow';

interface Props {
  primaryColor: string;
  onPrimaryColorChange: (v: string) => void;
  bgColor: string;
  onBgColorChange: (v: string) => void;
  headerTextColor: string;
  onHeaderTextColorChange: (v: string) => void;
  useGradient: boolean;
  onUseGradientChange: (v: boolean) => void;
  gradEnd: string;
  onGradEndChange: (v: string) => void;
  borderRadius: number;
  onBorderRadiusChange: (v: number) => void;
  borderWidth: number;
  onBorderWidthChange: (v: number) => void;
  formWidth: number;
  onFormWidthChange: (v: number) => void;
  fieldHeight: number;
  onFieldHeightChange: (v: number) => void;
  fieldGap: number;
  onFieldGapChange: (v: number) => void;
}

const StyleTab: FC<Props> = ({
  primaryColor, onPrimaryColorChange,
  bgColor, onBgColorChange,
  headerTextColor, onHeaderTextColorChange,
  useGradient, onUseGradientChange,
  gradEnd, onGradEndChange,
  borderRadius, onBorderRadiusChange,
  borderWidth, onBorderWidthChange,
  formWidth, onFormWidthChange,
  fieldHeight, onFieldHeightChange,
  fieldGap, onFieldGapChange,
}) => (
  <Box direction="vertical">
    <ColorPickerField label="Button colour" value={primaryColor} onChange={onPrimaryColorChange} />
    <ColorPickerField label="Background colour" value={bgColor} onChange={onBgColorChange} />
    <ColorPickerField label="Header text colour" value={headerTextColor} onChange={onHeaderTextColorChange} />

    <Divider />

    <ToggleRow
      label="Use gradient"
      checked={useGradient}
      onChange={onUseGradientChange}
      tooltip="Blends the background from the background colour to a second colour of your choice."
    />
    {useGradient && (
      <ColorPickerField label="Gradient end colour" value={gradEnd} onChange={onGradEndChange} />
    )}

    <Divider />

    <SliderField label="Border radius" value={borderRadius} min={0} max={32} onChange={onBorderRadiusChange} tooltip="Controls the roundness of the form card corners." />
    <SliderField label="Border width" value={borderWidth} min={0} max={6} onChange={onBorderWidthChange} tooltip="Thickness of the outline border. Set to 0 to remove it." />
    <SliderField label="Form width" value={formWidth} min={240} max={600} onChange={onFormWidthChange} tooltip="Maximum width of the form card in pixels." />
    <SliderField label="Field height" value={fieldHeight} min={28} max={52} onChange={onFieldHeightChange} tooltip="Height of each input field row." />
    <SliderField label="Gap between fields" value={fieldGap} min={4} max={24} onChange={onFieldGapChange} tooltip="Vertical spacing between input fields." />
  </Box>
);

export default StyleTab;
