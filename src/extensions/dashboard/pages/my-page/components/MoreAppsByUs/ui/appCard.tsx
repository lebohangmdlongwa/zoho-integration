import type { FC } from 'react';
import { Text } from '@wix/design-system';
import { styles } from './styles/appCard';
import { trackEvent } from '../../../utils/trackEvent';

interface AppCardProps {
  name: string;
  description: string;
  icon: string;
  url: string;
}

export const AppCard: FC<AppCardProps> = ({ name, description, icon, url }) => (
  <div style={styles.card}>
    <img src={icon} alt={name} style={styles.image} />
    <Text size="small" weight="bold">
      {name}
    </Text>
    <div style={styles.descriptionWrapper}>
      <Text size="tiny" secondary>
        {description}
      </Text>
    </div>
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackEvent('get_app_click', { app_name: name })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 16px',
        borderRadius: 20,
        border: '1px solid #2D6BDA',
        color: '#2D6BDA',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <Text size="tiny" weight="bold">
        <span style={{ color: '#2D6BDA' }}>Get App</span>
      </Text>
    </a>
  </div>
);
