/**
 * Returns a human-readable relative time string in Polish.
 * Falls back to a locale date string for anything older than a month.
 * Absolute time is preserved in the `title` attribute at the call site.
 */
export function timeAgo(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'teraz';
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffHour < 24) return diffHour === 1 ? '1 godz. temu' : `${diffHour} godz. temu`;
  if (diffDay === 1) return 'wczoraj';
  if (diffDay < 7) return `${diffDay} dni temu`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return weeks === 1 ? '1 tyg. temu' : `${weeks} tyg. temu`;
  }

  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: diffDay > 365 ? 'numeric' : undefined,
  });
}
