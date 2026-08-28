import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { demoAuditoria, filtrarAuditoria, textoDiff, type ItemAuditoria } from './auditoria'

export function AuditoriaPage() {
  const { fuente } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [rows, setRows] = useState<ItemAuditoria[]>(demoAuditoria())
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!live) {
      setRows(demoAuditoria())
      return
    }
    const { data, error } = await supabase
      .from('auditoria')
      .select('id, tabla, registro_id, accion, usuario_id, cambios, creado_en')
      .order('creado_en', { ascending: false })
      .limit(200)
    if (error) {
      setError(error.message)
      return
    }
    setRows(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        tabla: String(r.tabla),
        registro_id: String(r.registro_id ?? ''),
        accion: String(r.accion),
        usuario_id: r.usuario_id != null ? String(r.usuario_id) : null,
        cambios: (r.cambios ?? {}) as Record<string, unknown>,
        creado_en: String(r.creado_en),
      })),
    )
  }, [live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => filtrarAuditoria(rows, q), [rows, q])

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-12</p>
        <h2 className="font-serif text-3xl">Auditoría</h2>
        <p className="text-sm text-slate-600">Log de cambios por tabla y registro, con diff.</p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {!live && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Preview: bitácora de demostración.
        </p>
      )}
      <input
        type="search"
        placeholder="Buscar tabla, acción o registro…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Cuándo</th>
              <th className="px-4 py-3">Tabla</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Registro</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {new Date(r.creado_en).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">{r.tabla}</td>
                <td className="px-4 py-3">{r.accion}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.registro_id}</td>
                <td className="px-4 py-3">{r.usuario_nombre ?? r.usuario_id ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{textoDiff(r.cambios)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
