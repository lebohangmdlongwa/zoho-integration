import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const html = `<!DOCTYPE html>
<html><head><title>Connecting to ZOHO CRM...</title></head>
<body>
  <p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#667085;">
    ${error ? 'Connection failed. You can close this window.' : 'Connecting to ZOHO CRM…'}
  </p>
  <script>
    if (window.opener) {
      ${
        error
          ? `window.opener.postMessage({ type: 'zoho-error', error: ${JSON.stringify(error)} }, '*');`
          : `window.opener.postMessage({ type: 'zoho-code', code: ${JSON.stringify(code ?? '')} }, '*');`
      }
    }
  </script>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
};
