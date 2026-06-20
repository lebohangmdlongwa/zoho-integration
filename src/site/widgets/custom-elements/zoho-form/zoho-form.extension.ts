import { extensions } from '@wix/astro/builders';

export default extensions.customElement({
  id: '133feba5-6eb9-44a9-9ea3-b1408055ec10',
  name: 'Zoho CRM Form',
  width: {
    defaultWidth: 400,
    allowStretch: false
  },
  height: {
    defaultHeight: 520
  },
  installation: {
    autoAdd: true
  },
  presets: [
    {
      id: '0c5c1bc2-6dd4-48d9-90a8-bd1b80b38c69',
      name: 'Zoho CRM Form',
      thumbnailUrl: '{{BASE_URL}}/public/zoho-form-thumbnail.png',
    },
  ],
  
  behaviors: {
    dashboard: {
      dashboardPageComponentId: '1742b6a3-e4ad-4381-a2bc-961133180800'
    }
  },
  tagName: 'zoho-form',
  element: './site/widgets/custom-elements/zoho-form/widget/index.tsx',
  settings: './site/widgets/custom-elements/zoho-form/panel/index.tsx',
});
