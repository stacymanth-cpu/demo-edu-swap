export function isValidTeamsLink(link: string): boolean {
  const normalized = link.trim();
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    return hostname === 'teams.microsoft.com' || hostname.endsWith('.teams.microsoft.com') || hostname.includes('teams.microsoft.com');
  } catch {
    return false;
  }
}

export function resolveMeetingJoinTarget(link: string, origin: string) {
  const normalized = link.trim();
  if (!normalized) {
    return { kind: 'none' as const, href: '' };
  }

  try {
    const parsed = new URL(normalized, origin);
    if (parsed.origin === origin && parsed.pathname === '/video-call') {
      return { kind: 'internal' as const, href: `${parsed.pathname}${parsed.search}` };
    }

    if (isValidTeamsLink(normalized)) {
      return { kind: 'external' as const, href: normalized };
    }

    return { kind: 'external' as const, href: normalized };
  } catch {
    return { kind: 'external' as const, href: normalized };
  }
}
