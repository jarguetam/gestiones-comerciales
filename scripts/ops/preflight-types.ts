export type PreflightCode =
  | 'GC-OPS-001' // falta SUPABASE_ACCESS_TOKEN
  | 'GC-OPS-002' // token inválido
  | 'GC-OPS-003' // no puede leer proyecto
  | 'GC-OPS-004' // no puede listar migraciones
  | 'GC-OPS-005' // no puede listar functions
  | 'GC-OPS-006' // no puede crear/administrar staging
  | 'GC-OPS-007' // drift de migraciones
  | 'GC-OPS-008' // falta secret de GitHub requerido

export interface RemoteInventory {
  projectRef: string
  region: string | null
  postgresMajor: number | null
  migrations: string[]
  functions: string[]
  buckets: string[]
  cronJobs: string[]
  authHookEnabled: boolean | null
  siteUrl: string | null
}

export interface LocalInventory {
  migrations: string[]
  functions: string[]
}

export interface PreflightReport {
  ok: boolean
  code?: PreflightCode
  message: string
  local: LocalInventory
  remote?: RemoteInventory
  missing: string[]
  extraRemote: string[]
  canCreateProject: boolean
}

export function diffMigrations(local: string[], remote: string[]) {
  const r = new Set(remote)
  const l = new Set(local)
  return {
    missing: local.filter((m) => !r.has(m)),
    extraRemote: remote.filter((m) => !l.has(m)),
  }
}

const PREFLIGHT_MESSAGES: Record<PreflightCode, string> = {
  'GC-OPS-001': 'falta SUPABASE_ACCESS_TOKEN',
  'GC-OPS-002': 'token inválido',
  'GC-OPS-003': 'no puede leer proyecto',
  'GC-OPS-004': 'no puede listar migraciones',
  'GC-OPS-005': 'no puede listar functions',
  'GC-OPS-006': 'no puede crear/administrar staging',
  'GC-OPS-007': 'drift de migraciones',
  'GC-OPS-008': 'falta secret de GitHub requerido',
}

export function preflightMessage(code: PreflightCode): string {
  return `${code}: ${PREFLIGHT_MESSAGES[code]}`
}

export function summarizePreflight(report: PreflightReport): PreflightReport {
  if (report.missing.length > 0) {
    return {
      ...report,
      ok: false,
      code: 'GC-OPS-007',
      message: `GC-OPS-007: migraciones locales no aplicadas: ${report.missing.join(', ')}`,
    }
  }
  if (report.ok === false && report.code && report.code !== 'GC-OPS-007') {
    return report
  }
  return { ...report, ok: true, message: 'preflight ok' }
}
