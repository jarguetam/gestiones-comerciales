import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  estadoJob,
  etiquetaEstado,
  formatearBytes,
  resumenSalud,
  type EstadoJob,
  type SaludPlataforma,
} from './salud'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PAGE,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../components/ui'
import type { BadgeTone } from '../../components/ui/Badge'

const TONE: Record<EstadoJob, BadgeTone> = {
  ok: 'success',
  fallo: 'danger',
  atrasado: 'warning',
  no_programado: 'neutral',
}

export function SaludPage() {
  const [salud, setSalud] = useState<SaludPlataforma | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase.rpc('admin_salud_plataforma')
    if (error) {
      setError(error.message)
      setSalud(null)
      return
    }
    setSalud(data as SaludPlataforma)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const resumen = useMemo(() => (salud ? resumenSalud(salud) : null), [salud])

  return (
    <main className={PAGE}>
      <PageHeader
        spec="P-06"
        title="Salud de plataforma"
        description="Jobs pg_cron, errores de Edge e integraciones, y uso por empresa (dispositivos, storage, notificaciones)."
        actions={
          <Button variant="secondary" onClick={() => void cargar()}>
            Actualizar
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" role="alert">{error}</Alert>
      )}

      {error && !salud ? (
        <EmptyState titulo="No se pudo cargar la salud" descripcion="Reintentá o revisá el backend." />
      ) : !salud || !resumen ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi etiqueta="Empresas activas" valor={resumen.tenantsActivos} />
            <Kpi etiqueta="Dispositivos" valor={resumen.dispositivos} />
            <Kpi etiqueta="Errores 24 h" valor={resumen.errores24h} />
            <Kpi etiqueta="Jobs con problema" valor={resumen.jobsProblema} />
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Jobs pg_cron</h3>
            <Table>
              <THead>
                <Tr>
                  <Th>Job</Th>
                  <Th>Cron</Th>
                  <Th>Última corrida</Th>
                  <Th>Estado</Th>
                </Tr>
              </THead>
              <TBody>
                {salud.jobs.map((j) => {
                  const estado = estadoJob(j)
                  return (
                    <Tr key={j.nombre}>
                      <Td className="font-medium text-ink">{j.nombre}</Td>
                      <Td className="font-mono text-xs text-muted">{j.schedule}</Td>
                      <Td className="text-muted">
                        {j.ultima_corrida ? new Date(j.ultima_corrida).toLocaleString() : '—'}
                      </Td>
                      <Td>
                        <Badge tone={TONE[estado]}>{etiquetaEstado(estado)}</Badge>
                      </Td>
                    </Tr>
                  )
                })}
              </TBody>
            </Table>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-ink">Uso por empresa</h3>
            {salud.tenants.length === 0 ? (
              <EmptyState titulo="Sin empresas en tu alcance" />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Empresa</Th>
                    <Th>Dispositivos</Th>
                    <Th>Notificaciones 24 h</Th>
                    <Th>Storage</Th>
                    <Th>Errores Edge</Th>
                    <Th>Errores integración</Th>
                  </Tr>
                </THead>
                <TBody>
                  {salud.tenants.map((t) => (
                    <Tr key={t.id}>
                      <Td className="font-medium text-ink">
                        <Link to={`/empresas/${t.id}`} className="text-primary hover:underline">
                          {t.nombre}
                        </Link>
                        {!t.activo && (
                          <Badge className="ml-2" tone="neutral">inactiva</Badge>
                        )}
                      </Td>
                      <Td>{t.dispositivos_activos}</Td>
                      <Td>{t.notificaciones_24h}</Td>
                      <Td>{formatearBytes(t.storage_bytes)}</Td>
                      <Td>{t.errores_edge_24h}</Td>
                      <Td>{t.errores_integracion_24h}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs text-muted">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{valor}</p>
    </article>
  )
}
