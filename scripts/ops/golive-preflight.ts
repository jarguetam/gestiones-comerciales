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
  stagingHealth: 'success' | 'failure'
  sentryReleaseExists: boolean
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
    { id: 'staging-health', ok: input.stagingHealth === 'success', detail: input.stagingHealth },
    { id: 'sentry-release', ok: input.sentryReleaseExists, detail: 'web@sha' },
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

function envConclusion(
  name: string,
  allowed: readonly string[],
): string | undefined {
  const raw = process.env[name]?.trim()
  if (!raw) return undefined
  return allowed.includes(raw) ? raw : 'unknown'
}

function latestWorkflowConclusion(workflow: string): 'success' | 'failure' | 'unknown' {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', '--workflow', workflow, '--limit', '1', '--json', 'conclusion'],
      { encoding: 'utf8' },
    )
    const rows = JSON.parse(out) as { conclusion?: string }[]
    const c = rows[0]?.conclusion
    if (c === 'success' || c === 'failure') return c
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function gatherInput(root: string): Promise<GolivePreflightInput> {
  const local = evidenceFromDisk(root)
  const ci =
    (envConclusion('GOLIVE_CI_CONCLUSION', ['success', 'failure', 'unknown']) as
      | 'success'
      | 'failure'
      | 'unknown'
      | undefined) ?? latestWorkflowConclusion('CI')
  const pgtap =
    (envConclusion('GOLIVE_PGTAP_CONCLUSION', ['success', 'failure']) as 'success' | 'failure' | undefined) ??
    (ci === 'success' ? 'success' : 'failure')
  const stagingHealth =
    (envConclusion('GOLIVE_STAGING_HEALTH', ['success', 'failure']) as 'success' | 'failure' | undefined) ??
    latestWorkflowConclusion('Health probes')
  const sentry =
    process.env.GOLIVE_SENTRY_RELEASE === '1' || process.env.GOLIVE_SENTRY_RELEASE === 'true'
      ? true
      : process.env.GOLIVE_SENTRY_RELEASE === '0'
        ? false
        : Boolean(process.env.SENTRY_AUTH_TOKEN)
  return {
    gate0InventoryPath: process.env.GOLIVE_INVENTORY_PATH ?? 'docs/ops/inventory-latest.json',
    ciConclusion: ci,
    pgtapConclusion: pgtap,
    stagingHealth: stagingHealth === 'success' ? 'success' : 'failure',
    sentryReleaseExists: sentry,
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
