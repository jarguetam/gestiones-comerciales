#!/usr/bin/env node
import { htmlContainsDemoBoard, probeOk, type ProbeResult } from './health-probes.ts'

async function pages(url: string): Promise<ProbeResult> {
  const requestId = crypto.randomUUID()
  const res = await fetch(url, { headers: { 'x-request-id': requestId } })
  const html = await res.text()
  const demo = htmlContainsDemoBoard(html)
  return {
    name: `pages:${url}`,
    ok: probeOk({ kind: 'pages', status: res.status }) && !demo,
    status: res.status,
    requestId,
    detail: demo ? 'HTML contiene Entrar al tablero' : undefined,
  }
}

async function authGuard(base: string): Promise<ProbeResult> {
  const requestId = crypto.randomUUID()
  const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/auth-guard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
    body: '{}',
  })
  return {
    name: 'auth-guard',
    ok: probeOk({ kind: 'auth-guard', status: res.status }),
    status: res.status,
    requestId,
  }
}

async function postgrest(base: string, anon: string): Promise<ProbeResult> {
  const requestId = crypto.randomUUID()
  const res = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/now`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'x-request-id': requestId,
    },
    body: '{}',
  })
  return {
    name: 'postgrest',
    ok: probeOk({ kind: 'postgrest', status: res.status }),
    status: res.status,
    requestId,
  }
}

async function openIssue(body: string) {
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!repo || !token) {
    console.error('GC-OPS-008: falta GITHUB_REPOSITORY o GH_TOKEN para crear issue')
    return
  }
  await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: 'probe-failed',
      body,
      labels: ['ops-alert'],
    }),
  })
}

async function main() {
  const pagesUrl = process.env.PAGES_PROD_URL?.trim()
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const anon = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!pagesUrl || !supabaseUrl || !anon) {
    throw new Error('GC-OPS-008: faltan PAGES_PROD_URL, VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
  }
  const results = [
    await pages(pagesUrl),
    await authGuard(supabaseUrl),
    await postgrest(supabaseUrl, anon),
  ]
  console.log(JSON.stringify({ results }, null, 2))
  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    const requestId = failed[0].requestId
    await openIssue(
      `probe-failed\n\nrequest_id: ${requestId}\n\n\`\`\`json\n${JSON.stringify(failed, null, 2)}\n\`\`\``,
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
