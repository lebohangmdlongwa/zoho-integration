import { httpClient } from '@wix/essentials';

export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  console.log('[trackEvent] firing', eventName, properties ?? {});
  try {
    const res = await httpClient.fetchWithAuth('/api/zoho/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, properties }),
    });
    console.log('[trackEvent] response', eventName, res.status);
  } catch (err) {
    console.error('[trackEvent] fetch failed', eventName, err);
  }
}
