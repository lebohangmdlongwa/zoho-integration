import type { FC } from 'react';
import { Text } from '@wix/design-system';
import { s } from './styles/Topbar';

const PURPLE = '#734EE1';
const CROWN_PURPLE = '#8C1AF6';

interface TopbarProps {
  pageTitle: string;
  isConnected: boolean;
  orgId?: string | null;
  onUpgrade?: () => void;
  editorUrl?: string | null;
}

const PurpleLockup = () => (
  <svg
    width="132"
    height="23"
    viewBox="0 0 168 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <mask
      id="lockup-mask"
      style={{ maskType: 'luminance' }}
      maskUnits="userSpaceOnUse"
      x="0"
      y="0"
      width="29"
      height="29"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 0H28.8041V29H0V0Z"
        fill="white"
      />
    </mask>
    <g mask="url(#lockup-mask)">
      <rect width="28.8041" height="29" rx="3" fill="#734EE1" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.65942 8.22381H9.74251V3.02979H4.65942V8.22381Z"
        fill="white"
      />
      <path
        d="M11.8606 5.19409H16.9437H22.0267V10.3881V15.5822V20.7762H16.9436H11.8606L11.8607 25.9703H6.77759V20.7763V15.5822V10.3882L11.8606 10.3881V5.19409Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.8398 15.6094H16.9688V10.4062H11.8398V15.6094Z"
        fill="#734EE1"
      />
    </g>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M168 21.0039V25.224H150.657V2.49956H167.585V6.71964H155.809V11.6547H166.208V15.7451H155.809V21.0039H168ZM131.147 2.49956H136.281V20.9385H147.405V25.224H131.147V2.49956ZM117.047 14.6931C118.642 14.6931 119.855 14.334 120.687 13.6157C121.517 12.8974 121.933 11.8764 121.933 10.554C121.933 9.20715 121.517 8.17624 120.687 7.45681C119.855 6.7385 118.642 6.37934 117.047 6.37934H112.719V14.6931H117.047ZM117.58 2.49956C119.574 2.49956 121.304 2.83544 122.771 3.50608C124.24 4.17673 125.37 5.12894 126.163 6.36271C126.955 7.59647 127.353 9.05749 127.353 10.7457C127.353 12.4118 126.955 13.8673 126.163 15.1122C125.37 16.3559 124.24 17.3092 122.771 17.9688C121.304 18.6283 119.574 18.9587 117.58 18.9587H113.048V25.224H107.842V2.49956H117.58ZM98.6283 10.5362C98.6283 9.19606 98.2121 8.16848 97.3818 7.45238C96.5504 6.73739 95.3374 6.37934 93.7418 6.37934H89.4147V14.6931H93.7418C95.3374 14.6931 96.5504 14.3296 97.3818 13.6035C98.2121 12.8763 98.6283 11.8543 98.6283 10.5362ZM98.0299 25.224L93.7808 18.8944H89.0927V25.224H83.9949V2.49956H93.5293C95.4804 2.49956 97.1747 2.83544 98.612 3.50608C100.049 4.17673 101.156 5.12894 101.932 6.36271C102.708 7.59647 103.096 9.05749 103.096 10.7457C103.096 12.434 102.703 13.8895 101.916 15.1122C101.129 16.3348 100.012 17.2704 98.5643 17.92L103.506 25.224H98.0299ZM69.0894 25.7782C65.9264 25.7782 63.4647 24.8737 61.7044 23.0646C59.944 21.2555 59.0628 18.6727 59.0628 15.3161V2.49956H64.1877V15.1199C64.1877 19.2181 65.8321 21.2666 69.1208 21.2666C70.724 21.2666 71.9467 20.7711 72.79 19.779C73.6333 18.7869 74.056 17.2338 74.056 15.1199V2.49956H79.117V15.3161C79.117 18.6727 78.2358 21.2555 76.4754 23.0646C74.714 24.8737 72.2523 25.7782 69.0894 25.7782ZM45.5063 14.6931C47.1019 14.6931 48.3148 14.334 49.1462 13.6157C49.9765 12.8974 50.3917 11.8764 50.3917 10.554C50.3917 9.20715 49.9765 8.17624 49.1462 7.45681C48.3148 6.7385 47.1019 6.37934 45.5063 6.37934H41.1781V14.6931H45.5063ZM45.4974 2.49951C47.4908 2.49951 49.2208 2.83539 50.6884 3.50604C52.1572 4.17668 53.2867 5.12889 54.0801 6.36266C54.8725 7.59643 55.2692 9.05744 55.2692 10.7457C55.2692 12.4118 54.8725 13.8672 54.0801 15.1121C53.2867 16.3558 52.1572 17.3092 50.6884 17.9687C49.2208 18.6283 47.4908 18.9586 45.4974 18.9586H40.9654V25.2239H35.7581V2.49951H45.4974Z"
      fill="#734EE1"
    />
  </svg>
);

const CrownIcon = () => (
  <svg width="14" height="14" viewBox="0 -960 960 960" fill={CROWN_PURPLE}>
    <path d="M200-160v-80h560v80H200Zm0-140-51-321q-2 0-4.5.5t-4.5.5q-25 0-42.5-17.5T80-680q0-25 17.5-42.5T140-740q25 0 42.5 17.5T200-680q0 7-1.5 13t-3.5 11l125 56 125-171q-11-8-18-21t-7-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820q0 15-7 28t-18 21l125 171 125-56q-2-5-3.5-11t-1.5-13q0-25 17.5-42.5T820-740q25 0 42.5 17.5T880-680q0 25-17.5 42.5T820-620q-2 0-4.5-.5t-4.5-.5l-51 321H200Zm68-80h424l26-167-105 46-133-183-133 183-105-46 26 167Zm212 0Z" />
  </svg>
);

const APP_DEFINITION_ID = '1742b6a3-e4ad-4381-a2bc-961133180800';

function openEditor(editorUrl: string) {
  try {
    const url = new URL(editorUrl);
    url.searchParams.set('appDefinitionId', APP_DEFINITION_ID);
    window.open(url.toString(), '_blank');
  } catch {
    window.open(editorUrl, '_blank');
  }
}

const Topbar: FC<TopbarProps> = ({
  pageTitle,
  isConnected,
  orgId,
  onUpgrade,
  editorUrl,
}) => {
  return (
    <div style={s.bar}>
      <div style={s.titleWrap}>
        <Text weight="bold" size="medium">
          <span style={s.titleText}>{pageTitle}</span>
        </Text>
      </div>

      <div style={s.centerLockup}>
        <PurpleLockup />
      </div>

      <div style={s.actionsWrap}>
        {editorUrl && (
          <button
            onClick={() => openEditor(editorUrl)}
            style={s.editorBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8f9fc'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#667085">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
            <Text size="tiny" weight="bold">
              <span style={{ color: '#667085' }}>Open in Editor</span>
            </Text>
          </button>
        )}

        <button
          onClick={onUpgrade}
          style={s.upgradeBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0ecff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f8f9fc'; }}
        >
          <Text size="tiny" weight="bold">
            <span style={{ color: '#667085' }}>Upgrade</span>
          </Text>
          <CrownIcon />
        </button>
      </div>
    </div>
  );
};

export default Topbar;
