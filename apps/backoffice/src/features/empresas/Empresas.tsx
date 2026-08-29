import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { WizardEmpresa } from './WizardEmpresa'
import { nombreRubro } from './wizard'
import type { TenantRow } from './types'
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
import { buttonClass } from '../../components/ui/buttonVariants'

export function Empresas() {
  const { demo } = useAuth()
  const [tenants, setTenants] = useState<TenantRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setTenants([
        { id: 'demo', codigo: 'demo-agromoney', nombre: 'AgroMoney (demo)', rubro: 'agromoney', plan: 'estandar', activo: true },
        { id: 'demo2', codigo: 'demo-distri', nombre: 'Distribuidora GT (demo)', rubro: 'distribuidora', plan: 'basico', activo: true },
      ])
      return
    }
    const { data, error } = await supabase
      .from('tenant')
      .select('id, codigo, nombre, rubro, plan, activo')
      .order('creado_en', { ascending: false })
    if (error) setError(error.message)
    else setTenants(data as TenantRow[])
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <main className={PAGE}>
      <PageHeader
        spec="P-02"
        title="Empresas"
        actions={
          <>
            <Link to="/salud" className={buttonClass('secondary')}>
              Ver salud
            </Link>
            <Button onClick={() => setWizardOpen(true)}>+ Nueva empresa</Button>
          </>
        }
      />
      {demo && (
        <Alert tone="warning">Preview estático — abrí una fila para ver detalle y usuarios.</Alert>
      )}
      {error && (
        <Alert tone="danger" role="alert">{error}</Alert>
      )}
      {tenants === null ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : tenants.length === 0 ? (
        <EmptyState
          titulo="Sin empresas todavía"
          descripcion="Creá la primera con el wizard de alta."
          cta={{ etiqueta: 'Nueva empresa', onClick: () => setWizardOpen(true) }}
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Empresa</Th>
              <Th>Rubro</Th>
              <Th>Plan</Th>
              <Th>Estado</Th>
            </Tr>
          </THead>
          <TBody>
            {tenants.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium text-ink">
                  <Link to={`/empresas/${t.id}`} className="text-primary hover:underline">
                    {t.nombre}
                  </Link>
                </Td>
                <Td>{nombreRubro(t.rubro)}</Td>
                <Td>{t.plan}</Td>
                <Td>
                  <Badge tone={t.activo ? 'success' : 'neutral'}>{t.activo ? 'activa' : 'suspendida'}</Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {wizardOpen && (
        <WizardEmpresa
          onClose={() => setWizardOpen(false)}
          onCreated={() => { setWizardOpen(false); void cargar() }}
        />
      )}
    </main>
  )
}
