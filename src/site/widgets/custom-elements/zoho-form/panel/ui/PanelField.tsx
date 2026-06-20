import type { FC, ReactNode } from 'react';

const PanelField: FC<{ children: ReactNode; noDivider?: boolean }> = ({
  children,
  noDivider = false,
}) => (
  <div style={{ paddingTop: 12, paddingLeft: 20, paddingRight: 20, paddingBottom: noDivider ? 12 : 0 }}>
    {children}
    {!noDivider && (
      <div style={{ height: 1, background: '#e8e8e8', marginTop: 12 }} />
    )}
  </div>
);

export default PanelField;
