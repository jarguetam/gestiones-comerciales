const API = 'https://api.supabase.com/v1'

export function assertPitr(config: { enabled: boolean; retentionDays: number }) {
  if (!config.enabled || config.retentionDays < 7) throw new Error('GC-OPS-008')
}

export function parsePitrConfig(body: Record<string, unknown>): {
  enabled: boolean
  retentionDays: number
} {
  const enabled = Boolean(body.pitr_enabled ?? body.walg_enabled ?? body.enabled)
  const retentionDays = Number(
    body.pitr_retention_days ?? body.walg_archive_retention_days ?? body.retentionDays ?? 0,
  )
  return { enabled, retentionDays }
}

export async function enablePitr(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  const token = env.SUPABASE_ACCESS_TOKEN?.trim()
  const ref = env.SUPABASE_PROJECT_REF?.trim()
  if (!token) throw new Error('GC-OPS-001: falta SUPABASE_ACCESS_TOKEN')
  if (!ref) throw new Error('GC-OPS-008: falta SUPABASE_PROJECT_REF')

  const get = await fetchImpl(`${API}/projects/${ref}/database/pitr`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (get.status === 404 || get.status === 405) {
    throw new Error(
      'GC-OPS-006: Management API no expone PITR (projects/{ref}/database/pitr). Se requiere plan Pro y permiso projects:write.',
    )
  }
  if (get.status === 401 || get.status === 403) {
    throw new Error(`GC-OPS-006: token sin permiso para PITR (${get.status})`)
  }
  if (!get.ok) {
    throw new Error(`GC-OPS-008: no se pudo leer PITR (${get.status})`)
  }
  const current = parsePitrConfig((await get.json()) as Record<string, unknown>)
  if (!current.enabled || current.retentionDays < 7) {
    const patch = await fetchImpl(`${API}/projects/${ref}/database/pitr`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true, retentionDays: 7 }),
    })
    if (!patch.ok) {
      throw new Error(
        `GC-OPS-006: no se pudo habilitar PITR 7d (${patch.status}). Permiso projects:write.`,
      )
    }
    const next = parsePitrConfig((await patch.json()) as Record<string, unknown>)
    assertPitr(next)
    return next
  }
  assertPitr(current)
  return current
}

if (import.meta.url === `file://${process.argv[1]}`) {
  enablePitr(process.env)
    .then((c) => console.log(JSON.stringify({ ok: true, ...c })))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
