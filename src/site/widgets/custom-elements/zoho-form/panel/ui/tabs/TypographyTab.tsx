import type { FC } from 'react';
import { Box } from '@wix/design-system';
import SliderField from '../SliderField';

interface Props {
  titleFontSize: number;
  onTitleFontSizeChange: (v: number) => void;
  subtitleFontSize: number;
  onSubtitleFontSizeChange: (v: number) => void;
  submitLabelFontSize: number;
  onSubmitLabelFontSizeChange: (v: number) => void;
}

const TypographyTab: FC<Props> = ({
  titleFontSize, onTitleFontSizeChange,
  subtitleFontSize, onSubtitleFontSizeChange,
  submitLabelFontSize, onSubmitLabelFontSizeChange,
}) => (
  <Box direction="vertical">
    <SliderField label="Title font size" value={titleFontSize} min={10} max={32} onChange={onTitleFontSizeChange} tooltip="Font size of the form heading (e.g. 'Contact Us')." />
    <SliderField label="Subtitle font size" value={subtitleFontSize} min={8} max={20} onChange={onSubtitleFontSizeChange} tooltip="Font size of the subtitle below the heading." />
    <SliderField label="Button label font size" value={submitLabelFontSize} min={10} max={20} onChange={onSubmitLabelFontSizeChange} tooltip="Font size of the text inside the submit button." />
  </Box>
);

export default TypographyTab;
