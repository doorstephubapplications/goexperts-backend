export function cleanTag(val: string | null | undefined, fallback: string): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed || /^[0-9a-fA-F-]{24,}$/.test(trimmed)) return fallback;
  const parts = trimmed.split(',').map(s => s.trim()).filter(s => s && !/^[0-9a-fA-F-]{24,}$/.test(s));
  return parts.length > 0 ? parts[0] : fallback;
}

export function cleanDesc(val: string | null | undefined, fallback: string = ''): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed || /^[0-9a-fA-F-]{24,}$/.test(trimmed)) return fallback;
  const parts = trimmed.split(',').map(s => s.trim()).filter(s => s && !/^[0-9a-fA-F-]{24,}$/.test(s));
  return parts.length > 0 ? parts.join(', ') : fallback;
}

export function cleanProjectTitle(title: string | null | undefined, category: string | null | undefined, tech: string | null | undefined): string {
  if (!title || typeof title !== 'string') {
    if (category && category.trim()) return `${category.trim()} Project`;
    return 'Full-Stack Development';
  }
  const trimmed = title.trim();
  if (!trimmed || trimmed.toLowerCase() === 'untitled' || trimmed.toLowerCase() === 'untitled project' || trimmed.toLowerCase() === 'project') {
    if (tech && tech.trim()) return `${tech.trim()} Platform Development`;
    if (category && category.trim()) return `${category.trim()} Project`;
    return 'Full-Stack Web & Mobile App';
  }
  return trimmed;
}

export function cleanStartupTitle(title: string | null | undefined, startup: string | null | undefined, industry: string | null | undefined): string {
  const name = title || startup;
  if (!name || typeof name !== 'string') return industry ? `${industry} Venture` : 'Next-Gen Startup';
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === 'startup idea' || trimmed.toLowerCase() === 'untitled' || trimmed.includes("'s Startup") || trimmed.includes("’s Startup") || trimmed.includes("s Startup")) {
    return industry ? `${industry} Platform` : 'Next-Gen Startup';
  }
  return trimmed;
}

export function dedupeBy<T>(arr: T[], keyFn: (item: T) => any): T[] {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
