import type { FC } from 'react';
import { Box, Text, Input, InputArea } from '@wix/design-system';
import PanelField from '../PanelField';

const ACTIVE = '#116DFF';
const INACTIVE = '#6B7280';

interface Props {
  mode: string;
  onModeChange: (v: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  subtitle: string;
  onSubtitleChange: (v: string) => void;
  submitLabel: string;
  onSubmitLabelChange: (v: string) => void;
  successMsg: string;
  onSuccessMsgChange: (v: string) => void;
}

const modeBtn = (active: boolean) => ({
  flex: 1, padding: '12px 8px 10px', borderRadius: 12, cursor: 'pointer',
  border: `1.5px solid ${active ? ACTIVE : '#e8e8e8'}`,
  background: active ? '#f0f5ff' : '#fafafa',
  boxShadow: active ? '0 4px 12px rgba(17,109,255,0.14)' : '0 1px 3px rgba(0,0,0,0.06)',
  transition: 'all 0.15s ease',
  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 7,
});

const ContentTab: FC<Props> = ({
  mode, onModeChange,
  title, onTitleChange,
  subtitle, onSubtitleChange,
  submitLabel, onSubmitLabelChange,
  successMsg, onSuccessMsgChange,
}) => (
  <Box direction="vertical">
    {/* Display mode */}
    <PanelField noDivider>
      <Text size="small" weight="bold">Display Mode</Text>
      <Box direction="horizontal" gap="SP2" marginTop="SP2">
        {/* Expanded */}
        <button onClick={() => onModeChange('expanded')} style={modeBtn(mode === 'expanded')}>
          <div style={{ width: 44, height: 36, borderRadius: 6, background: '#fff', border: '1px solid #dde3ec', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', padding: '5px 5px 4px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 5, borderRadius: 2, background: mode === 'expanded' ? ACTIVE : '#c8d0dc', width: '70%' }} />
            <div style={{ height: 3, borderRadius: 2, background: '#e8ecf1', width: '100%' }} />
            <div style={{ height: 3, borderRadius: 2, background: '#e8ecf1', width: '100%' }} />
            <div style={{ height: 5, borderRadius: 3, background: mode === 'expanded' ? ACTIVE : '#c8d0dc', width: '100%', marginTop: 2 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: mode === 'expanded' ? ACTIVE : INACTIVE }}>Expanded</span>
        </button>

        {/* Compact */}
        <button onClick={() => onModeChange('compressed')} style={modeBtn(mode === 'compressed')}>
          <div style={{ width: 44, height: 36, borderRadius: 6, background: '#fff', border: '1px solid #dde3ec', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            <div style={{ width: 32, height: 10, borderRadius: 10, background: mode === 'compressed' ? ACTIVE : '#c8d0dc', boxShadow: mode === 'compressed' ? '0 2px 6px rgba(17,109,255,0.3)' : 'none' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: mode === 'compressed' ? ACTIVE : INACTIVE }}>Compact</span>
        </button>
      </Box>
    </PanelField>

    {/* Title */}
    <PanelField noDivider>
      <Box direction="vertical" gap="SP1">
        <Text size="small">Form title</Text>
        <Input size="small" value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Contact Us" />
      </Box>
    </PanelField>

    {/* Subtitle */}
    <PanelField noDivider>
      <Box direction="vertical" gap="SP1">
        <Text size="small">Subtitle</Text>
        <Input size="small" value={subtitle} onChange={(e) => onSubtitleChange(e.target.value)} placeholder="Fill in your details below" />
      </Box>
    </PanelField>

    {/* Button label */}
    <PanelField noDivider>
      <Box direction="vertical" gap="SP1">
        <Text size="small">Button label</Text>
        <Input size="small" value={submitLabel} onChange={(e) => onSubmitLabelChange(e.target.value)} placeholder="Submit" />
      </Box>
    </PanelField>

    {/* Success message */}
    <PanelField noDivider>
      <Box direction="vertical" gap="SP1">
        <Text size="small">Success message</Text>
        <InputArea
          value={successMsg}
          onChange={(e) => onSuccessMsgChange(e.target.value)}
          placeholder="Thank you! We'll be in touch soon."
          minRowsAutoGrow={2}
          autoGrow
        />
      </Box>
    </PanelField>
  </Box>
);

export default ContentTab;
