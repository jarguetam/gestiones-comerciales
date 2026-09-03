export function logoUrlValido(url: string | undefined | null): string | null {
  if (!url) return null
  const t = url.trim()
  if (!t || t.length > 2048) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    return u.href
  } catch {
    return null
  }
}

export function monograma(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'GC'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
