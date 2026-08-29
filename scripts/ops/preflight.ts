import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  diffMigrations,
  preflightMessage,
  summarizePreflight,
  type PreflightCode,
  type PreflightReport,
  type RemoteInventory,
} from './preflight-types.ts'
import { getJson, redact, requireToken } from './supabase-mgmt.ts'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations')
const FUNCTIONS_DIR = path.join(ROOT, 'supabase/functions')
const INVENTORY_PATH = path.join(ROOT, 'docs/ops/inventory-latest.json')
const DEFAULT_PROJECT_REF = 'xcoeipsnykceorcvjwve'
const API = 'https://api.supabase.com/v1'

type MigrationRow = { version?: string; name?: string }
type ProjectBody = {
  ref?: string
  region?: string
  database?: { version?: string; postgres_engine?: string }
}
type FunctionRow = { slug?: string; name?: string; status?: string }
type OrganizationRow = { slug?: string }

export async function listLocalMigrations(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR)
  return entries.filter((name) => name.endsWith('.sql')).sort()
}

export async function listLocalFunctions(): Promise<string[]> {
  const entries = await readdir(FUNCTIONS_DIR, { withFileTypes: true })
  const names: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    try {
      const files = await readdir(path.join(FUNCTIONS_DIR, entry.name))
      if (files.includes('index.ts')) names.push(entry.name)
    } catch {
      // ignore unreadable function dirs
    }
  }
  return names.sort()
}

export function finalizePreflight(report: PreflightReport): PreflightReport {
  const summarized = summarizePreflight(report)
  if (report.extraRemote.length > 0) {
    return {
      ...summarized,
      ok: false,
      code: 'GC-OPS-007',
      message: `GC-OPS-007: migraciones remotas no versionadas: ${report.extraRemote.join(', ')}`,
    }
  }
  return summarized
}

async function safeGetJson(
  url: string,
  token: string,
): Promise<{ status: number; body: unknown }> {
  try {
    return await getJson(url, token)
  } catch {
    return { status: 500, body: null }
  }
}

function migrationFilename(row: MigrationRow): string | null {
  const version = row.version?.trim()
  if (!version) return null
  const name = row.name?.trim()
  return name ? `${version}_${name}.sql` : `${version}.sql`
}

function migrationNames(body: unknown): string[] {
  if (!Array.isArray(body)) return []
  return body
    .map((row) => migrationFilename(row as MigrationRow))
    .filter((name): name is string => Boolean(name))
    .sort()
}

function functionNames(body: unknown): string[] {
  if (!Array.isArray(body)) return []
  return body
    .map((row) => {
      const fn = row as FunctionRow
      return fn.slug ?? fn.name ?? null
    })
    .filter((name): name is string => Boolean(name))
    .sort()
}

function postgresMajor(body: ProjectBody): number | null {
  const engine = body.database?.postgres_engine
  if (engine) {
    const match = /(\d+)/.exec(engine)
    if (match) return Number.parseInt(match[1], 10)
  }
  const version = body.database?.version
  if (version) {
    const match = /^(\d+)/.exec(version)
    if (match) return Number.parseInt(match[1], 10)
  }
  return null
}

async function checkCanCreateProject(
  token: string,
): Promise<{ canCreateProject: boolean; code?: PreflightCode }> {
  const orgs = await safeGetJson(`${API}/organizations`, token)
  if (orgs.status === 401 || orgs.status === 403) {
    return { canCreateProject: false, code: 'GC-OPS-006' }
  }
  if (orgs.status !== 200 || !Array.isArray(orgs.body) || orgs.body.length === 0) {
    return { canCreateProject: false, code: 'GC-OPS-006' }
  }

  const slug = (orgs.body[0] as OrganizationRow).slug?.trim()
  if (!slug) return { canCreateProject: false, code: 'GC-OPS-006' }

  const regions = await safeGetJson(
    `${API}/projects/available-regions?organization_slug=${encodeURIComponent(slug)}`,
    token,
  )
  if (regions.status === 401 || regions.status === 403) {
    return { canCreateProject: false, code: 'GC-OPS-006' }
  }
  if (regions.status !== 200) {
    return { canCreateProject: false, code: 'GC-OPS-006' }
  }
  return { canCreateProject: true }
}

async function writeInventory(report: PreflightReport): Promise<void> {
  await mkdir(path.dirname(INVENTORY_PATH), { recursive: true })
  await writeFile(INVENTORY_PATH, `${JSON.stringify(redact(report), null, 2)}\n`, 'utf8')
}

function isLocalOnly(env: NodeJS.ProcessEnv): boolean {
  return env.PREFLIGHT_LOCAL_ONLY === '1'
}

function fail(
  base: PreflightReport,
  code: PreflightCode,
  canCreateProject: boolean,
): PreflightReport {
  return finalizePreflight({
    ...base,
    canCreateProject,
    code,
    ok: false,
    message: preflightMessage(code),
  })
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<PreflightReport> {
  const localMigrations = await listLocalMigrations()
  const localFunctions = await listLocalFunctions()
  const base: PreflightReport = {
    ok: true,
    message: '',
    local: { migrations: localMigrations, functions: localFunctions },
    missing: [],
    extraRemote: [],
    canCreateProject: false,
  }

  if (isLocalOnly(env)) {
    const report: PreflightReport = {
      ...base,
      ok: true,
      message: 'preflight ok (local-only)',
    }
    await writeInventory(report)
    return report
  }

  let token: string
  try {
    token = requireToken(env)
  } catch (err) {
    const message = preflightMessage('GC-OPS-001')
    const report: PreflightReport = {
      ...base,
      ok: false,
      code: 'GC-OPS-001',
      message,
    }
    await writeInventory(report)
    throw new Error(message)
  }

  const projectRef = env.SUPABASE_PROJECT_REF?.trim() || DEFAULT_PROJECT_REF
  const createCheck = await checkCanCreateProject(token)

  const projectRes = await safeGetJson(`${API}/projects/${projectRef}`, token)
  if (projectRes.status === 401) {
    const code = createCheck.code ?? 'GC-OPS-002'
    const report = fail(base, code, createCheck.canCreateProject)
    await writeInventory(report)
    return report
  }
  if (projectRes.status !== 200) {
    const code = createCheck.code ?? 'GC-OPS-003'
    const report = fail(base, code, createCheck.canCreateProject)
    await writeInventory(report)
    return report
  }

  const migrationsRes = await safeGetJson(
    `${API}/projects/${projectRef}/database/migrations`,
    token,
  )
  if (migrationsRes.status === 401) {
    const code = createCheck.code ?? 'GC-OPS-002'
    const report = fail(base, code, createCheck.canCreateProject)
    await writeInventory(report)
    return report
  }
  if (migrationsRes.status !== 200) {
    const code = createCheck.code ?? 'GC-OPS-004'
    const report = fail(base, code, createCheck.canCreateProject)
    await writeInventory(report)
    return report
  }

  const functionsRes = await safeGetJson(`${API}/projects/${projectRef}/functions`, token)
  if (functionsRes.status === 401) {
    const code = createCheck.code ?? 'GC-OPS-002'
    const report = fail(base, code, createCheck.canCreateProject)
    await writeInventory(report)
    return report
  }
  if (functionsRes.status !== 200) {
    const code = createCheck.code ?? 'GC-OPS-005'
    const report = fail(base, code, createCheck.canCreateProject)
    await writeInventory(report)
    return report
  }

  const projectBody = projectRes.body as ProjectBody
  const remoteMigrations = migrationNames(migrationsRes.body)
  const { missing, extraRemote } = diffMigrations(localMigrations, remoteMigrations)
  const remote: RemoteInventory = {
    projectRef,
    region: projectBody.region ?? null,
    postgresMajor: postgresMajor(projectBody),
    migrations: remoteMigrations,
    functions: functionNames(functionsRes.body),
    buckets: [],
    cronJobs: [],
    authHookEnabled: null,
    siteUrl: null,
  }

  let report: PreflightReport = {
    ...base,
    remote,
    missing,
    extraRemote,
    canCreateProject: createCheck.canCreateProject,
    message: '',
    ok: true,
  }

  report = finalizePreflight(report)
  if (!createCheck.canCreateProject && report.ok) {
    report = fail(report, 'GC-OPS-006', createCheck.canCreateProject)
  }

  await writeInventory(report)
  return report
}

const entry = process.argv[1]
if (entry && fileURLToPath(import.meta.url) === path.resolve(entry)) {
  main()
    .then((report) => {
      console.log(JSON.stringify(redact(report)))
      process.exit(report.ok ? 0 : 1)
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.log(message)
      process.exit(1)
    })
}
