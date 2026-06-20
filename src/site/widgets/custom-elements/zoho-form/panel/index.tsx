import { type FC, useState, useEffect, useCallback } from 'react';
import { widget } from '@wix/editor';
import { httpClient } from '@wix/essentials';
import { SidePanel, WixDesignSystemProvider, Box, Text } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import TabBar, { type TabItem } from './ui/TabBar';
import ContentTab from './ui/tabs/ContentTab';
import StyleTab from './ui/tabs/StyleTab';
import CompressedTab from './ui/tabs/CompressedTab';
import TypographyTab from './ui/tabs/TypographyTab';

const baseApiUrl = new URL(import.meta.url).origin;
const ZOHO_BLUE = '#2D6BDA';

const TABS: TabItem[] = [
  {
    id: 'content',
    label: 'Content',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M4 7h12M4 10.5h12M4 14h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'typography',
    label: 'Typography',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14M10 5v11M7 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'style',
    label: 'Expanded',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M10 2C10 2 4 9 4 13a6 6 0 0012 0C16 9 10 2 10 2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'compressed',
    label: 'Compact',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="7" width="16" height="6" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 10h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

const Panel: FC = () => {
  const [activeTab, setActiveTab] = useState('content');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);

  /* Content */
  const [mode, setMode] = useState('expanded');
  const [title, setTitle] = useState('Contact Us');
  const [subtitle, setSubtitle] = useState('Fill in your details below');
  const [submitLabel, setSubmitLabel] = useState('Submit');
  const [successMsg, setSuccessMsg] = useState("Thank you! We'll be in touch soon.");
  const [titleFontSize, setTitleFontSize] = useState(14);
  const [subtitleFontSize, setSubtitleFontSize] = useState(10);
  const [submitLabelFontSize, setSubmitLabelFontSize] = useState(13);

  /* Style */
  const [primaryColor, setPrimaryColor] = useState(ZOHO_BLUE);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [headerTextColor, setHeaderTextColor] = useState('#101828');
  const [useGradient, setUseGradient] = useState(false);
  const [gradEnd, setGradEnd] = useState('#eef3ff');
  const [borderRadius, setBorderRadius] = useState(18);
  const [borderWidth, setBorderWidth] = useState(2);
  const [formWidth, setFormWidth] = useState(340);
  const [fieldHeight, setFieldHeight] = useState(36);
  const [fieldGap, setFieldGap] = useState(12);

  /* Compressed */
  const [cBgColor, setCBgColor] = useState(ZOHO_BLUE);
  const [cUseGradient, setCUseGradient] = useState(false);
  const [cGradEnd, setCGradEnd] = useState('#91b4f0');
  const [cFontSize, setCFontSize] = useState(11);
  const [cWidth, setCWidth] = useState(340);
  const [cBorderRadius, setCBorderRadius] = useState(18);
  const [cBorderWidth, setCBorderWidth] = useState(2);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'wds-tooltip-light';
    style.textContent = `:root{--wds-tooltip-background-fill:#ffffff;--wds-tooltip-text-fill:#000000;}`;
    if (!document.getElementById('wds-tooltip-light')) document.head.appendChild(style);
    return () => document.getElementById('wds-tooltip-light')?.remove();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [statusRes, ...props] = await Promise.all([
          httpClient.fetchWithAuth(`${baseApiUrl}/api/zoho/status`).then((r) => r.json()) as Promise<{ connected: boolean; instanceId?: string }>,
          widget.getProp('submiturl'),
          widget.getProp('instanceid'),
          widget.getProp('mode'),
          widget.getProp('title'),
          widget.getProp('subtitle'),
          widget.getProp('submitlabel'),
          widget.getProp('successmsg'),
          widget.getProp('titlefontsize'),
          widget.getProp('subtitlefontsize'),
          widget.getProp('submitlabelfontsize'),
          widget.getProp('primarycolor'),
          widget.getProp('bgcolor'),
          widget.getProp('headertextcolor'),
          widget.getProp('usegradient'),
          widget.getProp('gradend'),
          widget.getProp('borderradius'),
          widget.getProp('borderwidth'),
          widget.getProp('formwidth'),
          widget.getProp('fieldheight'),
          widget.getProp('fieldgap'),
          widget.getProp('compressedbgcolor'),
          widget.getProp('compressedusegradient'),
          widget.getProp('compressedgradend'),
          widget.getProp('compressedfontsize'),
          widget.getProp('compressedwidth'),
          widget.getProp('compressedborderradius'),
          widget.getProp('compressedborderwidth'),
        ]);

        const [
          savedUrl, savedInstanceId, savedMode, savedTitle, savedSubtitle,
          savedLabel, savedSuccess, savedTitleFs, savedSubtitleFs,
          savedSubmitLabelFs, savedPrimary, savedBg, savedHeaderText,
          savedGradient, savedGradEnd, savedRadius, savedBorderW,
          savedFormW, savedFieldH, savedFieldG, savedCBg, savedCGrad,
          savedCGradEnd, savedCFont, savedCW, savedCRadius, savedCBorderW,
        ] = props;

        setConnected(statusRes.connected);

        if (!savedUrl) {
          await widget.setProp('submiturl', `${baseApiUrl}/api/zoho/form-submit`);
        }
        if (!savedInstanceId && statusRes.instanceId) {
          await widget.setProp('instanceid', statusRes.instanceId);
        }

        if (savedMode) setMode(savedMode);
        if (savedTitle) setTitle(savedTitle);
        if (savedSubtitle) setSubtitle(savedSubtitle);
        if (savedLabel) setSubmitLabel(savedLabel);
        if (savedSuccess) setSuccessMsg(savedSuccess);
        if (savedTitleFs) setTitleFontSize(Number(savedTitleFs));
        if (savedSubtitleFs) setSubtitleFontSize(Number(savedSubtitleFs));
        if (savedSubmitLabelFs) setSubmitLabelFontSize(Number(savedSubmitLabelFs));
        if (savedPrimary) setPrimaryColor(savedPrimary);
        if (savedBg) setBgColor(savedBg);
        if (savedHeaderText) setHeaderTextColor(savedHeaderText);
        if (savedGradient) setUseGradient(savedGradient === 'true');
        if (savedGradEnd) setGradEnd(savedGradEnd);
        if (savedRadius) setBorderRadius(Number(savedRadius));
        if (savedBorderW) setBorderWidth(Number(savedBorderW));
        if (savedFormW) setFormWidth(Number(savedFormW));
        if (savedFieldH) setFieldHeight(Number(savedFieldH));
        if (savedFieldG) setFieldGap(Number(savedFieldG));
        if (savedCBg) setCBgColor(savedCBg);
        if (savedCGrad) setCUseGradient(savedCGrad === 'true');
        if (savedCGradEnd) setCGradEnd(savedCGradEnd);
        if (savedCFont) setCFontSize(Number(savedCFont));
        if (savedCW) setCWidth(Number(savedCW));
        if (savedCRadius) setCBorderRadius(Number(savedCRadius));
        if (savedCBorderW) setCBorderWidth(Number(savedCBorderW));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = useCallback((key: string, value: string) => widget.setProp(key, value), []);

  if (loading) {
    return (
      <WixDesignSystemProvider features={{ newColorsBranding: true }}>
        <Box padding="SP6" align="center">
          <Text size="small" secondary>Loading…</Text>
        </Box>
      </WixDesignSystemProvider>
    );
  }

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <SidePanel width="288" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <div style={{ fontFamily: 'Madefor, sans-serif' }}>
            <TabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

            {connected === false && (
              <div style={{ margin: '8px 12px', padding: '10px 12px', background: '#fff7ec', border: '1px solid #fde68a', borderRadius: 8 }}>
                <Text size="tiny" weight="bold">
                  <span style={{ color: '#92400e' }}>Zoho CRM not connected</span>
                </Text>
                <div style={{ marginTop: 2 }}>
                  <Text size="tiny" secondary>Complete setup on the dashboard</Text>
                </div>
              </div>
            )}

            <Box direction="vertical">
              {activeTab === 'content' && (
                <ContentTab
                  mode={mode} onModeChange={(v) => { setMode(v); void set('mode', v); }}
                  title={title} onTitleChange={(v) => { setTitle(v); void set('title', v); }}
                  subtitle={subtitle} onSubtitleChange={(v) => { setSubtitle(v); void set('subtitle', v); }}
                  submitLabel={submitLabel} onSubmitLabelChange={(v) => { setSubmitLabel(v); void set('submitlabel', v); }}
                  successMsg={successMsg} onSuccessMsgChange={(v) => { setSuccessMsg(v); void set('successmsg', v); }}
                />
              )}

              {activeTab === 'style' && (
                <StyleTab
                  primaryColor={primaryColor} onPrimaryColorChange={(v) => { setPrimaryColor(v); void set('primarycolor', v); }}
                  bgColor={bgColor} onBgColorChange={(v) => { setBgColor(v); void set('bgcolor', v); void set('gradstart', v); }}
                  headerTextColor={headerTextColor} onHeaderTextColorChange={(v) => { setHeaderTextColor(v); void set('headertextcolor', v); }}
                  useGradient={useGradient} onUseGradientChange={(v) => { setUseGradient(v); void set('usegradient', String(v)); }}
                  gradEnd={gradEnd} onGradEndChange={(v) => { setGradEnd(v); void set('gradend', v); }}
                  borderRadius={borderRadius} onBorderRadiusChange={(v) => { setBorderRadius(v); void set('borderradius', String(v)); }}
                  borderWidth={borderWidth} onBorderWidthChange={(v) => { setBorderWidth(v); void set('borderwidth', String(v)); }}
                  formWidth={formWidth} onFormWidthChange={(v) => { setFormWidth(v); void set('formwidth', String(v)); }}
                  fieldHeight={fieldHeight} onFieldHeightChange={(v) => { setFieldHeight(v); void set('fieldheight', String(v)); }}
                  fieldGap={fieldGap} onFieldGapChange={(v) => { setFieldGap(v); void set('fieldgap', String(v)); }}
                />
              )}

              {activeTab === 'typography' && (
                <TypographyTab
                  titleFontSize={titleFontSize} onTitleFontSizeChange={(v) => { setTitleFontSize(v); void set('titlefontsize', String(v)); }}
                  subtitleFontSize={subtitleFontSize} onSubtitleFontSizeChange={(v) => { setSubtitleFontSize(v); void set('subtitlefontsize', String(v)); }}
                  submitLabelFontSize={submitLabelFontSize} onSubmitLabelFontSizeChange={(v) => { setSubmitLabelFontSize(v); void set('submitlabelfontsize', String(v)); }}
                />
              )}

              {activeTab === 'compressed' && (
                <CompressedTab
                  cBgColor={cBgColor} onCBgColorChange={(v) => { setCBgColor(v); void set('compressedbgcolor', v); }}
                  cUseGradient={cUseGradient} onCUseGradientChange={(v) => { setCUseGradient(v); void set('compressedusegradient', String(v)); }}
                  cGradEnd={cGradEnd} onCGradEndChange={(v) => { setCGradEnd(v); void set('compressedgradend', v); }}
                  cFontSize={cFontSize} onCFontSizeChange={(v) => { setCFontSize(v); void set('compressedfontsize', String(v)); }}
                  cWidth={cWidth} onCWidthChange={(v) => { setCWidth(v); void set('compressedwidth', String(v)); }}
                  cBorderRadius={cBorderRadius} onCBorderRadiusChange={(v) => { setCBorderRadius(v); void set('compressedborderradius', String(v)); }}
                  cBorderWidth={cBorderWidth} onCBorderWidthChange={(v) => { setCBorderWidth(v); void set('compressedborderwidth', String(v)); }}
                  headerTextColor={headerTextColor} onHeaderTextColorChange={(v) => { setHeaderTextColor(v); void set('headertextcolor', v); }}
                />
              )}
            </Box>
          </div>
        </SidePanel.Content>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
