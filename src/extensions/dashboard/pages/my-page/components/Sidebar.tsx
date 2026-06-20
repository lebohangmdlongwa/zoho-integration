import type { FC } from 'react';
import { Text } from '@wix/design-system';
import { s } from './styles/Sidebar';

export type PageKey =
  | 'dashboard'
  | 'contacts'
  | 'deals'
  | 'widget'
  | 'fieldMapping'
  | 'activity'
  | 'embedSecurity'
  | 'plans'
  | 'support';

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const PlansIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
  </svg>
);

const SupportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" />
  </svg>
);

const DealsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
  </svg>
);

const FieldMappingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
  </svg>
);

const ConnectedIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

const NotConnectedIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.98 2.63-2.31 2.98l1.46 1.46C20.88 15.61 22 13.95 22 12c0-2.76-2.24-5-5-5zm-1 4h-2.19l2 2H16v-2zM2 4.27l3.11 3.11C3.29 8.12 2 9.91 2 12c0 2.76 2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1 0-1.52 1.09-2.78 2.53-3.06L8.73 11H8v2h2.73l2 2H8v1.9h4.46l3.26 3.26 1.42-1.42L3.42 2.86 2 4.27z" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
  </svg>
);

const MAIN_NAV_ITEMS: { key: PageKey; label: string; icon: JSX.Element }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { key: 'contacts', label: 'Manage Contacts', icon: <PeopleIcon /> },
  { key: 'fieldMapping', label: 'Field Mapping', icon: <FieldMappingIcon /> },
  { key: 'deals', label: 'Deals', icon: <DealsIcon /> },
];

const SETTINGS_NAV_ITEMS: { key: PageKey; label: string; icon: JSX.Element }[] =
  [
    { key: 'plans', label: 'Plans', icon: <PlansIcon /> },
    { key: 'support', label: 'Support', icon: <SupportIcon /> },
  ];

interface SidebarProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  isConnected: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const Sidebar: FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isConnected,
  expanded,
  onToggle,
}) => {
  return (
    <div style={s.sidebar(expanded)}>
      {/* Brand header */}
      <div style={s.brandHeader}>
        <img
          src="/zoho-logo.svg"
          alt="Zoho CRM"
          style={{ height: expanded ? 40 : 36, width: 'auto', flexShrink: 0 }}
        />
        {expanded && (
          <span style={{ color: '#101828', fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px', whiteSpace: 'nowrap', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            Zoho CRM
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav style={s.nav}>
        {/* Main nav items */}
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.key;
          return (
            <button
              key={item.key}
              title={!expanded ? item.label : undefined}
              onClick={() => onNavigate(item.key)}
              style={s.navBtn(expanded, isActive)}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = 'rgba(45,107,218,0.08)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={s.navIcon(isActive)}>{item.icon}</span>
              {expanded && (
                <Text size="small" weight="normal">
                  <span style={s.navLabel(isActive)}>{item.label}</span>
                </Text>
              )}
            </button>
          );
        })}

        {/* Settings section */}
        <div style={s.settingsDividerRow}>
          {expanded ? (
            <div style={s.settingsLabelRow}>
              <Text size="tiny">
                <span style={s.settingsLabel}>Settings</span>
              </Text>
              <div style={s.settingsDividerLine} />
            </div>
          ) : (
            <div style={s.settingsDividerLineCollapsed} />
          )}
        </div>

        {SETTINGS_NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.key;
          return (
            <button
              key={item.key}
              title={!expanded ? item.label : undefined}
              onClick={() => onNavigate(item.key)}
              style={s.navBtn(expanded, isActive)}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.background = 'rgba(45,107,218,0.08)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={s.navIcon(isActive)}>{item.icon}</span>
              {expanded && (
                <Text size="small" weight="normal">
                  <span style={s.navLabel(isActive)}>{item.label}</span>
                </Text>
              )}
            </button>
          );
        })}
      </nav>

      {/* Connection status badge */}
      <div style={expanded ? s.statusBadge : s.statusBadgeCollapsed}>
        {expanded ? (
          <div style={s.statusPill(isConnected)}>
            <span style={{ color: '#fff', display: 'flex', alignItems: 'center' }}>
              {isConnected ? <ConnectedIcon /> : <NotConnectedIcon />}
            </span>
            <Text size="tiny">
              <span style={s.statusText}>
                {isConnected ? 'Connected' : 'Not connected'}
              </span>
            </Text>
          </div>
        ) : (
          <div
            style={s.statusDot(isConnected)}
            title={isConnected ? 'Connected' : 'Not connected'}
          >
            {isConnected ? <ConnectedIcon /> : <NotConnectedIcon />}
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <div style={s.toggleRow}>
        <button
          onClick={onToggle}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          style={s.toggleBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(45,107,218,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {expanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
