import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { filtrarAuditoria, textoDiff, type ItemAuditoria } from './auditoria'
import { Alert, Input, PageHeader, PAGE, Table, TBody, Td, Th, THead, Tr, TableSkeleton } from '../../components/ui'

export function AuditoriaPage() {
  const { fuente } = useDominio()
  const live = fuente === 'supabase'
  const [rows, setRows] = useState<ItemAuditoria[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!live) {
      setRows([])
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

  const visibles = useMemo(() => filtrarAuditoria(rows ?? [], q), [rows, q])

  return (
    <div className={PAGE}>
      <PageHeader spec="W-12" title="Auditoría" description="Log de cambios por tabla y registro, con diff." />
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!live && <Alert tone="warning">Preview: bitácora de demostración.</Alert>}
      <Input
        id="buscar-auditoria"
        label="Buscar"
        type="search"
        placeholder="Buscar tabla, acción o registro…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {rows === null ? (
        <TableSkeleton cols={6} />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Cuándo</Th>
              <Th>Tabla</Th>
              <Th>Acción</Th>
              <Th>Registro</Th>
              <Th>Usuario</Th>
              <Th>Diff</Th>
            </tr>
          </THead>
          <TBody>
            {visibles.map((r) => (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap text-muted">{new Date(r.creado_en).toLocaleString()}</Td>
                <Td className="font-medium">{r.tabla}</Td>
                <Td>{r.accion}</Td>
                <Td className="font-mono text-xs">{r.registro_id}</Td>
                <Td>{r.usuario_nombre ?? r.usuario_id ?? '—'}</Td>
                <Td className="text-muted">{textoDiff(r.cambios)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
