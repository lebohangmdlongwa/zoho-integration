// Receives the Zoho OAuth redirect and passes the code back to the dashboard popup.
// The actual token exchange happens in exchange-token.ts, which runs inside the Wix SDK
// auth context so it can capture siteId — required for the webhook handler to work.
export async function handleZohoCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  const html = `<!DOCTYPE html>
<html><head><title>ZOHO CRM Connecting…</title></head>
<body>
  <p>Connecting to ZOHO CRM…</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'zoho-code', code: ${JSON.stringify(code)} }, '*');
    }
    setTimeout(function() { window.close(); }, 800);
  </script>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
