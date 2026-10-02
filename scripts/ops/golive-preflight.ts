import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path, { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseAuthHookConfig } from './check-auth-hook.ts'
import { parsePitrConfig } from './enable-pitr.ts'

const API = 'https://api.supabase.com/v1'

export type GoliveCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GolivePreflightInput = {
  gate0InventoryPath: string
  ciConclusion: 'success' | 'failure' | 'unknown'
  pgtapConclusion: 'success' | 'failure'
  productionHealth: 'success' | 'failure'
  sentryConfigured: boolean
  demoStringInAppsSrc: boolean
  appArtifactTrackedInGit: boolean
  /** Go-live (GOLIVE_FULL=1): exige además la evidencia operativa del proyecto. */
  full: boolean
  remote: RemoteOpsEvidence
}

type Evidence = { ok: boolean; detail: string }

export type RemoteOpsEvidence = {
  drift: Evidence
  pitr: Evidence
  authHook: Evidence
  smtp: Evidence
  cron: Evidence
}

export async function runGolivePreflight(input: GolivePreflightInput): Promise<{
  ready: boolean
  checks: GoliveCheck[]
}> {
  const checks: GoliveCheck[] = [
    { id: 'ci', ok: input.ciConclusion === 'success', detail: input.ciConclusion },
    { id: 'pgtap', ok: input.pgtapConclusion === 'success', detail: input.pgtapConclusion },
    { id: 'production-health', ok: input.productionHealth === 'success', detail: input.productionHealth },
    { id: 'sentry-config', ok: input.sentryConfigured, detail: 'org + web + backoffice' },
    { id: 'no-demo', ok: !input.demoStringInAppsSrc, detail: 'DEMO_MODE en apps/*/src' },
    { id: 'no-apk-git', ok: !input.appArtifactTrackedInGit, detail: '*.apk / *.aab' },
  ]
  if (input.full) {
    const r = input.remote
    checks.push(
      { id: 'migrations-drift', ...r.drift },
      { id: 'pitr', ...r.pitr },
      { id: 'auth-hook', ...r.authHook },
      { id: 'smtp', ...r.smtp },
      { id: 'cron', ...r.cron },
    )
  }
  return { ready: checks.every((c) => c.ok), checks }
}

export function collectLocalEvidence(input: {
  srcFiles: { path: string; content: string }[]
  gitTracked: string[]
}): { demoStringInAppsSrc: boolean; appArtifactTrackedInGit: boolean } {
  return {
    demoStringInAppsSrc: input.srcFiles.some((f) =>
      !/\.test\.tsx?$/.test(f.path) && f.content.includes('DEMO_MODE')),
    appArtifactTrackedInGit: input.gitTracked.some((f) => /\.(apk|aab)$/.test(f)),
  }
}

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walkTs(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

export function evidenceFromDisk(root: string): { demoStringInAppsSrc: boolean; appArtifactTrackedInGit: boolean } {
  const files = ['web', 'backoffice', 'mobile']
    .flatMap((app) => walkTs(join(root, 'apps', app, 'src')))
    .map((path) => ({ path, content: readFileSync(path, 'utf8') }))
  const gitTracked = execFileSync('git', ['ls-files', '*.apk', '*.aab'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
  return collectLocalEvidence({ srcFiles: files, gitTracked })
}

/** Migraciones remotas que el repo no tiene = drift (GC-OPS-007). Pendientes locales sí se permiten. */
export function evaluateDrift(localVersions: string[], remoteVersions: string[]): Evidence {
  const local = new Set(localVersions)
  const extra = remoteVersions.filter((v) => !local.has(v))
  return extra.length === 0
    ? { ok: true, detail: `${remoteVersions.length} remotas versionadas` }
    : { ok: false, detail: `GC-OPS-007: remotas no versionadas: ${extra.join(', ')}` }
}

export function evaluatePitr(body: Record<string, unknown>): Evidence {
  const pitr = parsePitrConfig(body)
  return {
    ok: pitr.enabled && pitr.retentionDays >= 7,
    detail: `enabled=${pitr.enabled} retención=${pitr.retentionDays}d`,
  }
}

export function evaluateSmtp(auth: Record<string, unknown>): Evidence {
  const host = typeof auth.smtp_host === 'string' ? auth.smtp_host.trim() : ''
  return host ? { ok: true, detail: 'SMTP propio configurado' } : { ok: false, detail: 'GC-OPS-008: sin SMTP propio' }
}

/** Último estado por job activo; un job que nunca corrió (anual) no bloquea. */
export function evaluateCron(rows: { jobname?: string; ultimo?: string | null }[]): Evidence {
  if (rows.length === 0) return { ok: false, detail: 'sin jobs pg_cron' }
  const fallidos = rows.filter((r) => r.ultimo && r.ultimo !== 'succeeded').map((r) => r.jobname)
  return fallidos.length === 0
    ? { ok: true, detail: `${rows.length} jobs sin fallos` }
    : { ok: false, detail: `jobs con última ejecución fallida: ${fallidos.join(', ')}` }
}

const CRON_SQL = `select j.jobname,
  (select d.status from cron.job_run_details d where d.jobid = j.jobid
    order by d.start_time desc limit 1) as ultimo
  from cron.job j where j.active`

async function mgmt(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`)
  return res.json()
}

async function remoteEvidence(root: string, env: NodeJS.ProcessEnv): Promise<RemoteOpsEvidence> {
  const token = env.SUPABASE_ACCESS_TOKEN?.trim()
  const ref = env.SUPABASE_PROJECT_REF?.trim()
  const sinToken = { ok: false, detail: 'GC-OPS-001: faltan SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF' }
  if (!token || !ref) return { drift: sinToken, pitr: sinToken, authHook: sinToken, smtp: sinToken, cron: sinToken }

  const attempt = async (fn: () => Promise<Evidence>): Promise<Evidence> => {
    try {
      return await fn()
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) }
    }
  }
  const localVersions = readdirSync(join(root, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.split('_')[0])
  let auth: Record<string, unknown> | undefined
  const authConfig = async () => (auth ??= await mgmt(token, `/projects/${ref}/config/auth`) as Record<string, unknown>)
  return {
    drift: await attempt(async () => {
      const rows = await mgmt(token, `/projects/${ref}/database/migrations`) as { version?: string }[]
      return evaluateDrift(localVersions, rows.map((r) => r.version ?? '').filter(Boolean))
    }),
    pitr: await attempt(async () => evaluatePitr(await mgmt(token, `/projects/${ref}/database/pitr`) as Record<string, unknown>)),
    authHook: await attempt(async () => {
      const hook = parseAuthHookConfig(await authConfig())
      return { ok: hook.ok, detail: hook.message }
    }),
    smtp: await attempt(async () => evaluateSmtp(await authConfig())),
    cron: await attempt(async () => evaluateCron(await mgmt(token, `/projects/${ref}/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query: CRON_SQL }),
    }) as { jobname?: string; ultimo?: string | null }[])),
  }
}

export function evaluateHealthEvidence(
  rows: { conclusion?: string; updatedAt?: string }[],
  now = Date.now(),
): 'success' | 'failure' {
  const latest = rows[0]
  const age = now - Date.parse(latest?.updatedAt ?? '')
  return latest?.conclusion === 'success' && age >= 0 && age <= 60 * 60 * 1000
    ? 'success' : 'failure'
}

function latestHealthConclusion(): 'success' | 'failure' {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', '--workflow', 'Health probes', '--limit', '1', '--json', 'conclusion,updatedAt'],
      { encoding: 'utf8' },
    )
    return evaluateHealthEvidence(JSON.parse(out) as { conclusion?: string; updatedAt?: string }[])
  } catch {
    return 'failure'
  }
}

export function sentryConfigPresent(env: Record<string, string | undefined>): boolean {
  return ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT_WEB', 'SENTRY_PROJECT_BACKOFFICE']
    .every((name) => Boolean(env[name]?.trim()))
}

type CiRun = {
  headSha?: string
  headBranch?: string
  event?: string
  status?: string
  conclusion?: string
  databaseId?: number
}

type CiJob = { name?: string; conclusion?: string }

export function evaluateCiEvidence(
  runs: CiRun[],
  candidateSha: string,
  jobs: CiJob[],
): { ci: 'success' | 'failure' | 'unknown'; pgtap: 'success' | 'failure'; runId: number | null } {
  const run = runs.find((row) =>
    row.headSha === candidateSha && row.headBranch === 'main' &&
    row.event === 'push' && row.status === 'completed',
  )
  if (!run?.databaseId) return { ci: 'unknown', pgtap: 'failure', runId: null }
  const ci = run.conclusion === 'success' || run.conclusion === 'failure' ? run.conclusion : 'unknown'
  const pgtap = jobs.some((job) => job.name === 'pgTAP (blank + replay)' && job.conclusion === 'success')
    ? 'success' : 'failure'
  return { ci, pgtap, runId: run.databaseId }
}

function candidateCiEvidence(root: string): { ci: 'success' | 'failure' | 'unknown'; pgtap: 'success' | 'failure' } {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    const rows = JSON.parse(execFileSync('gh', [
      'run', 'list', '--workflow', 'CI', '--branch', 'main', '--event', 'push', '--commit', sha,
      '--limit', '10', '--json', 'headSha,headBranch,event,status,conclusion,databaseId',
    ], { cwd: root, encoding: 'utf8' })) as CiRun[]
    const runId = evaluateCiEvidence(rows, sha, []).runId
    if (!runId) return { ci: 'unknown', pgtap: 'failure' }
    const details = JSON.parse(execFileSync('gh', [
      'run', 'view', String(runId), '--json', 'jobs',
    ], { cwd: root, encoding: 'utf8' })) as { jobs?: CiJob[] }
    const { ci, pgtap } = evaluateCiEvidence(rows, sha, details.jobs ?? [])
    return { ci, pgtap }
  } catch {
    return { ci: 'unknown', pgtap: 'failure' }
  }
}

export async function gatherInput(root: string): Promise<GolivePreflightInput> {
  const local = evidenceFromDisk(root)
  const { ci, pgtap } = candidateCiEvidence(root)
  const productionHealth = latestHealthConclusion()
  return {
    gate0InventoryPath: process.env.GOLIVE_INVENTORY_PATH ?? 'docs/ops/inventory-latest.json',
    ciConclusion: ci,
    pgtapConclusion: pgtap,
    productionHealth: productionHealth === 'success' ? 'success' : 'failure',
    sentryConfigured: sentryConfigPresent(process.env),
    demoStringInAppsSrc: local.demoStringInAppsSrc,
    appArtifactTrackedInGit: local.appArtifactTrackedInGit,
    full: process.env.GOLIVE_FULL === '1' || process.argv.includes('--full'),
    remote: await remoteEvidence(root, process.env),
  }
}

async function main() {
  const root = process.cwd()
  const input = await gatherInput(root)
  const result = await runGolivePreflight(input)
  console.log(JSON.stringify({ ready: result.ready, checks: result.checks, input }, null, 2))
  if (!result.ready) {
    console.error('GC-OPS-009: golive-preflight no ready')
    process.exit(1)
  }
}

const entry = process.argv[1]
if (entry && fileURLToPath(import.meta.url) === path.resolve(entry)) {
  void main()
}
