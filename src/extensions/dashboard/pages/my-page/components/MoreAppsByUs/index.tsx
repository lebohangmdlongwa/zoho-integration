import type { FC } from 'react';
import { Box, Card, Cell, Layout, Text } from '@wix/design-system';
import { styles } from './styles';
import { AppCard } from './ui/appCard';
import { trackEvent } from '../../utils/trackEvent';

const APPS = [
  {
    name: 'Frequently Bought Together',
    description:
      'Boost sales by showing related products customers often buy together.',
    icon: 'https://static.wixstatic.com/media/1fff64_8e60357c0b134468a6c6f4c7e4570de5~mv2.png',
    url: 'https://www.wix.com/app-market/17d75b11-b574-4b49-9708-4ffa8be777a6',
  },
  {
    name: '360° Product Viewer',
    description: 'Let shoppers spin and explore products from every angle.',
    icon: 'https://static.wixstatic.com/media/1fff64_b3b04fc957894b29a0129bbc599baf03~mv2.png',
    url: 'https://www.wix.com/app-market/dd2b43ee-f3e5-4ca2-bb87-73f41be78d18',
  },
  {
    name: 'Shipping Address Verifier',
    description:
      'Validate shipping addresses at checkout to reduce failed deliveries.',
    icon: 'https://static.wixstatic.com/media/1fff64_13f16a4f398e4a26b9d223ef37c3cd5f~mv2.png',
    url: 'https://www.wix.com/app-market/shipping-address-verifier',
  },
  {
    name: 'Google Drive Content',
    description:
      'Display Google Drive files and folders directly on your site.',
    icon: 'https://static.wixstatic.com/media/1fff64_333756fc4b2a4d6c8f9612d38b9298d7~mv2.png',
    url: 'https://www.wix.com/app-market/6d396a1f-1145-4feb-9531-3b520ab4389e',
  },
];

const EXPLORE_URL = 'https://www.wix.com/app-market/developer/purple';

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
  </svg>
);

export const MoreAppsByUs: FC = () => (
  <Box marginTop="SP6">
    <Layout>
      <Cell span={12}>
        <div
          style={{
            border: '1px solid #e8ecf1',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <Card>
            <Card.Content>
              <Box direction="vertical" gap="SP4">
                <Box align="center">
                  <Text size="medium" weight="bold">
                    More apps by us
                  </Text>
                </Box>

                <div style={styles.appsGrid}>
                  {APPS.map((app) => (
                    <AppCard key={app.url} {...app} />
                  ))}
                </div>

                <Box
                  direction="horizontal"
                  verticalAlign="middle"
                  marginTop="SP1"
                >
                  <Box flex="1">
                    <a
                      href={EXPLORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.exploreLink}
                      onClick={() => trackEvent('explore_more_apps_click')}
                    >
                      Explore more apps <ExternalLinkIcon />
                    </a>
                  </Box>
                  <a
                    href={EXPLORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.poweredByRow, cursor: 'pointer', textDecoration: 'none' }}
                    onClick={() => trackEvent('powered_by_purple_click')}
                  >
                    <span style={styles.poweredByText}>Powered by</span>
                    <img
                      src="/purple-logo.png"
                      alt="PRPL"
                      style={styles.poweredByLogo}
                    />
                  </a>
                </Box>
              </Box>
            </Card.Content>
          </Card>
        </div>
      </Cell>
    </Layout>
  </Box>
);
