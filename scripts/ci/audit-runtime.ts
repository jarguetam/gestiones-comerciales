export type AuditAdvisory = {
  module_name?: string
  severity?: string
  findings?: { paths?: string[] }[]
}

export type AuditReport = {
  advisories?: Record<string, AuditAdvisory>
}

const BLOCKING = new Set(['high', 'critical'])
const RUNTIME_PREFIX = ['apps/web >', 'apps/backoffice >']

export function runtimePaths(paths: string[]): string[] {
  return paths.filter((p) => RUNTIME_PREFIX.some((prefix) => p.startsWith(prefix)))
}

export function blockingRuntimeAdvisories(report: AuditReport): string[] {
  const out: string[] = []
  for (const adv of Object.values(report.advisories ?? {})) {
    if (!BLOCKING.has((adv.severity ?? '').toLowerCase())) continue
    const paths = (adv.findings ?? []).flatMap((f) => f.paths ?? [])
    const hit = runtimePaths(paths)
    if (hit.length > 0) out.push(`${adv.severity} ${adv.module_name}: ${hit[0]}`)
  }
  return out.sort()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = await new Response(process.stdin).text()
  const report = JSON.parse(raw) as AuditReport
  const blocking = blockingRuntimeAdvisories(report)
  if (blocking.length > 0) {
    console.error('GC-OPS-008: vulnerabilidades high/critical en runtime web/backoffice:')
    for (const line of blocking) console.error(`  - ${line}`)
    process.exit(1)
  }
  console.log('OK: audit --prod sin high/critical en @gc/web ni @gc/backoffice')
}
