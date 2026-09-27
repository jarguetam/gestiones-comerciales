import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path, { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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
  demoStringInWebSrc: boolean
  apkTrackedInGit: boolean
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
    { id: 'no-demo', ok: !input.demoStringInWebSrc, detail: 'DEMO_MODE' },
    { id: 'no-apk-git', ok: !input.apkTrackedInGit, detail: 'releases/*.apk' },
  ]
  return { ready: checks.every((c) => c.ok), checks }
}

export function collectLocalEvidence(input: {
  webSrcFiles: { path: string; content: string }[]
  gitTracked: string[]
}): { demoStringInWebSrc: boolean; apkTrackedInGit: boolean } {
  return {
    demoStringInWebSrc: input.webSrcFiles.some((f) => f.content.includes('DEMO_MODE')),
    apkTrackedInGit: input.gitTracked.some((f) => f.endsWith('.apk')),
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

export function evidenceFromDisk(root: string): { demoStringInWebSrc: boolean; apkTrackedInGit: boolean } {
  const webSrc = join(root, 'apps/web/src')
  const files = walkTs(webSrc).map((path) => ({
    path,
    content: readFileSync(path, 'utf8'),
  }))
  let gitTracked: string[] = []
  try {
    gitTracked = execFileSync('git', ['ls-files', '*.apk'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch {
    gitTracked = []
  }
  return collectLocalEvidence({ webSrcFiles: files, gitTracked })
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
    demoStringInWebSrc: local.demoStringInWebSrc,
    apkTrackedInGit: local.apkTrackedInGit,
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
