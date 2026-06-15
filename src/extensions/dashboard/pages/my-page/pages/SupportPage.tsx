import type { FC } from 'react';
import { useState } from 'react';
import { Box, Card, Cell, Layout, Text } from '@wix/design-system';

const SUPPORT_EMAIL = 'apps-support@prpl.io';

const FAQ_ITEMS = [
  {
    question: 'How do I connect my Zoho CRM account?',
    answer:
      'Click "Connect Zoho CRM" on the Dashboard page or in the setup banner at the top. You\'ll be redirected to Zoho\'s OAuth authorization page. After granting access, you\'ll be automatically redirected back and your account will be connected.',
  },
  {
    question: 'How does contact sync work?',
    answer:
      'When a new contact is created or updated in Wix, our app automatically syncs that information to your Zoho CRM based on your field mapping configuration. You can also trigger a manual sync by clicking "Sync Now" on the Dashboard.',
  },
  {
    question: 'What happens when a contact is updated in Wix?',
    answer:
      'Depending on your field mapping direction settings, updates to Wix contacts are pushed to Zoho CRM in real time. You can configure bidirectional sync so that changes in Zoho CRM also flow back into Wix.',
  },
  {
    question: 'Can I customize which fields are synced?',
    answer:
      'Yes! Use the Field Mapping section on the Dashboard to map Wix contact fields to Zoho CRM properties. For each mapping you can set the direction (Wix → Zoho, Zoho → Wix, or both) and apply transforms like Trim, Lowercase, or Uppercase.',
  },
  {
    question: 'What is the Zoho webhook channel and why does it expire?',
    answer:
      'Zoho CRM uses a channel-based webhook system. The app automatically registers a notification channel when you connect. If the channel expires, the app will attempt to re-register it on the next sync. You can also disconnect and reconnect to force a fresh channel registration.',
  },
  {
    question: 'How do I cancel or change my plan?',
    answer:
      'Visit the Plans page to view available tiers and upgrade at any time. To cancel, go to your Wix dashboard, open Manage Apps, find this app, and select "Cancel Plan". Your data is retained for 30 days after cancellation.',
  },
];

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

const EmailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#2D6BDA">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
);

const SupportPage: FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div
      style={{
        padding: '20px 32px',
        background: '#f4f5f7',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Layout>
        <Cell span={12}>
          <Box direction="vertical" gap="SP4">
            <Card>
              <Card.Header title="Frequently Asked Questions" />
              <Card.Divider />
              <Card.Content>
                {FAQ_ITEMS.map((item, i) => (
                  <div key={i}>
                    <button
                      onClick={() => toggle(i)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 0',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: 12,
                      }}
                    >
                      <Text weight={openIndex === i ? 'bold' : 'normal'}>
                        {item.question}
                      </Text>
                      <div
                        style={{
                          flexShrink: 0,
                          color: openIndex === i ? '#2D6BDA' : '#667085',
                          transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease, color 0.15s ease',
                          display: 'flex',
                        }}
                      >
                        <ChevronDown />
                      </div>
                    </button>

                    {openIndex === i && (
                      <div
                        style={{
                          paddingBottom: 16,
                          paddingLeft: 12,
                          borderLeft: '3px solid #a8c4f5',
                          marginBottom: 4,
                        }}
                      >
                        <Text secondary size="small">
                          {item.answer}
                        </Text>
                      </div>
                    )}

                    {i < FAQ_ITEMS.length - 1 && (
                      <div style={{ height: 1, background: '#f0f4f7' }} />
                    )}
                  </div>
                ))}
              </Card.Content>
            </Card>

            <Card>
              <Card.Content>
                <Box direction="vertical" align="center" padding="SP4" gap="SP2">
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: '#EEF3FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <EmailIcon />
                  </div>
                  <Box direction="vertical" align="center" gap="SP1">
                    <Text weight="bold" size="medium">Still need help?</Text>
                    <Text secondary>
                      Our support team is ready to assist you with any questions or issues.
                    </Text>
                  </Box>
                  <Box direction="vertical" align="center" gap="SP2">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: '#f4f5f7',
                        border: '1px solid #e8ecf1',
                      }}
                    >
                      <Text size="small" secondary>{SUPPORT_EMAIL}</Text>
                    </div>
                    <button
                      onClick={copyEmail}
                      style={{
                        padding: '10px 28px',
                        background: copied
                          ? 'linear-gradient(135deg, #3ba755 0%, #2d8a45 100%)'
                          : 'linear-gradient(135deg, #2D6BDA 0%, #1a52b8 100%)',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease, background 0.2s ease',
                        minWidth: 160,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <Text size="small" weight="bold" light>
                        {copied ? '✓ Email Copied!' : 'Copy Email Address'}
                      </Text>
                    </button>
                  </Box>
                </Box>
              </Card.Content>
            </Card>
          </Box>
        </Cell>
      </Layout>
    </div>
  );
};

export default SupportPage;
