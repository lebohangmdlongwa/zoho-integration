const SENSITIVE_KEYS = [
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'client_secret',
  'authorization',
  'password',
  'service_role',
];

function redact(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))
        ? '[REDACTED]'
        : redact(v),
    ]),
  );
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user[0]}***@${domain}`;
}

export const logger = {
  info: (msg: string, data?: unknown) =>
    console.log(`[INFO]  ${msg}`, data !== undefined ? redact(data) : ''),
  warn: (msg: string, data?: unknown) =>
    console.warn(`[WARN]  ${msg}`, data !== undefined ? redact(data) : ''),
  error: (msg: string, data?: unknown) =>
    console.error(`[ERROR] ${msg}`, data !== undefined ? redact(data) : ''),
};
