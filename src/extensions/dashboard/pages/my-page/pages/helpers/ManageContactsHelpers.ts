interface ContactRow {
  wix_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function directionLabel(dir: string | null): string {
  if (!dir) return '—';
  if (dir === 'wix_to_zoho') return 'Wix → Zoho';
  if (dir === 'zoho_to_wix') return 'Zoho → Wix';
  if (dir === 'form_submit') return 'Form Submit';
  return dir.replace(/_/g, ' ');
}

export function initials(c: ContactRow): string {
  if (c.first_name || c.last_name) {
    return (
      `${c.first_name.charAt(0)}${c.last_name.charAt(0)}`.toUpperCase() ||
      c.first_name.slice(0, 2).toUpperCase()
    );
  }
  return c.wix_id.slice(0, 2).toUpperCase();
}

export function displayName(c: ContactRow): string {
  const name = `${c.first_name} ${c.last_name}`.trim();
  if (name) return name;
  if (c.email) return c.email;
  return shortId(c.wix_id);
}

const AVATAR_COLORS = ['#FF7A59', '#3ba755', '#e06b1f', '#2563eb', '#dc2626', '#7c3aed'];

export function avatarColor(id: string): string {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
