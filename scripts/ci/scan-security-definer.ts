import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const CREATE_FN = /create(?:\s+or\s+replace)?\s+function\s+([a-z0-9_.]+)/gi

export function extractSecurityDefinerFunctions(sql: string): string[] {
  const names = new Set<string>()
  const startRe = /create(?:\s+or\s+replace)?\s+function\s+([a-z0-9_.]+)/gi
  const starts: { name: string; index: number }[] = []
  let match: RegExpExecArray | null
  while ((match = startRe.exec(sql))) {
    starts.push({ name: match[1].toLowerCase(), index: match.index })
  }
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : sql.length
    const chunk = sql.slice(starts[i].index, end)
    const header = chunk.split(/\$\$|\$function\$/i)[0] ?? chunk
    if (/security\s+definer/i.test(header)) names.add(starts[i].name)
  }
  return [...names].sort()
}

export function parseAllowlist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#'))
    .sort()
}

export function unexpectedDefiners(found: string[], allow: string[]): string[] {
  const ok = new Set(allow)
  return found.filter((name) => !ok.has(name))
}

export function scanMigrations(migrationsDir: string, allowlistPath: string) {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const found = new Set<string>()
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
    for (const name of extractSecurityDefinerFunctions(sql)) found.add(name)
  }
  const allow = parseAllowlist(readFileSync(allowlistPath, 'utf8'))
  const unexpected = unexpectedDefiners([...found].sort(), allow)
  return { found: [...found].sort(), allow, unexpected }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
  const report = scanMigrations(
    path.join(root, 'supabase/migrations'),
    path.join(root, 'supabase/tests/security_definer_allowlist.txt'),
  )
  if (report.unexpected.length > 0) {
    console.error('SECURITY DEFINER sin allowlist:')
    for (const name of report.unexpected) console.error(`  - ${name}`)
    process.exit(1)
  }
  console.log(`OK: ${report.found.length} funciones SECURITY DEFINER en allowlist`)
}
