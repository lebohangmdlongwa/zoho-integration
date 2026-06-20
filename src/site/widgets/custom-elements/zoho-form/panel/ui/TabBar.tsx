import type { FC, ReactNode } from 'react';
import { styles } from './styles/TabBar';

export interface TabItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}

const TabBar: FC<TabBarProps> = ({ tabs, activeTab, onSelect }) => (
  <div style={styles.stickyWrapper}>
    <div style={styles.container}>
      {tabs.map(({ id, label, icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            style={{ ...styles.tab, ...(isActive ? styles.tabActive : {}), color: isActive ? '#2D6BDA' : '#6B7280' }}
            onClick={() => onSelect(id)}
          >
            {icon}
            <span style={{ ...styles.label, color: isActive ? '#2D6BDA' : '#6B7280' }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

export default TabBar;
