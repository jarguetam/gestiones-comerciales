const FALLBACK: Record<string, string> = {
  '--gc-primary': '#111111',
  '--gc-ink': '#111111',
  '--gc-warn': '#B45309',
  '--gc-muted': '#52525B',
  '--gc-canvas': '#FAFAF8',
}

export function colorDeToken(token: string, fallback?: string): string {
  const fb = fallback ?? FALLBACK[token] ?? '#111111'
  if (typeof document === 'undefined') return fb
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return v || fb
}
