#!/usr/bin/env node
import { gzipSync } from 'node:zlib'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ENTRY_MAX_GZIP = 450 * 1024
export const TOTAL_MAX_GZIP = 900 * 1024

export function walkJs(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkJs(p, acc)
    else if (name.endsWith('.js')) acc.push(p)
  }
  return acc
}

export function gzipBytes(buf) {
  return gzipSync(buf).length
}

export function evaluateBudget(distDir, limits = {}) {
  const entryMax = limits.entryMax ?? ENTRY_MAX_GZIP
  const totalMax = limits.totalMax ?? TOTAL_MAX_GZIP
  const assets = existsSync(join(distDir, 'assets')) ? join(distDir, 'assets') : distDir
  const paths = walkJs(assets)
  const files = paths.map((p) => {
    const raw = readFileSync(p)
    return {
      path: p,
      name: basename(p),
      gzip: gzipBytes(raw),
      text: raw.toString('utf8'),
    }
  })
  const errors = []
  const total = files.reduce((n, f) => n + f.gzip, 0)
  const indexes = files.filter((f) => /^index-[^/]+\.js$/.test(f.name)).sort((a, b) => b.gzip - a.gzip)
  const entry =
    indexes[0] ??
    files.filter((f) => !/mapa|leaflet/i.test(f.name)).sort((a, b) => b.gzip - a.gzip)[0]

  if (entry && entry.gzip > entryMax) {
    errors.push(`entry ${entry.name} ${entry.gzip} B gzip > ${entryMax}`)
  }
  if (total > totalMax) {
    errors.push(`total JS ${total} B gzip > ${totalMax}`)
  }
  for (const f of files) {
    if (/leaflet/i.test(f.text) && !/mapa|leaflet/i.test(f.name)) {
      errors.push(`Leaflet filtró a ${f.name}; debe vivir en el chunk mapa`)
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    total,
    entry: entry ? { name: entry.name, gzip: entry.gzip } : null,
    files: files.map((f) => ({ name: f.name, gzip: f.gzip })),
  }
}

function main() {
  const dir = process.argv[2] ?? 'apps/web/dist'
  const result = evaluateBudget(dir)
  if (!result.ok) {
    console.error(result.errors.join('\n'))
    process.exit(1)
  }
  const entry = result.entry ? `${result.entry.name} ${result.entry.gzip}` : '—'
  console.log(`OK bundle web: entry ${entry} B gzip; total ${result.total} B gzip`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
