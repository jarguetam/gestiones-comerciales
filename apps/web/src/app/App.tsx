import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { Login } from '../features/auth/Login'
import { RecuperarPasswordPage } from '../features/auth/RecuperarPasswordPage'
import { RequireAuth } from './RequireAuth'
import { EmpresaApp } from './EmpresaApp'
import { DashboardHome } from '../features/dashboard/DashboardHome'
import { VisitasPage } from '../features/visitas/VisitasPage'
import { PersonasPage } from '../features/personas/PersonasPage'
import { CrmPage } from '../features/crm/CrmPage'
import { SolicitudesPage } from '../features/solicitudes/SolicitudesPage'
import { DepositosPage } from '../features/depositos/DepositosPage'
import { CuentasPage } from '../features/cuentas/CuentasPage'
import { KilometrajePage } from '../features/kilometraje/KilometrajePage'
import { CatalogosPage } from '../features/configuracion/CatalogosPage'
import { UsuariosPage } from '../features/usuarios/UsuariosPage'
import { FormulariosPage } from '../features/formularios/FormulariosPage'
const MapaPage = lazy(() => import('../features/mapa/MapaPage'))
import { AuditoriaPage } from '../features/auditoria/AuditoriaPage'
import { NotificacionesPage } from '../features/notificaciones/NotificacionesPage'
import { useDominio } from './DominioContext'
import { useAuth } from '../features/auth/useAuth'
import { mostrarAuditoria } from '../lib/claims'
import { RequireRol } from '../components/RequireRol'

function RequiereAdmin({ children }: { children: ReactNode }) {
  const { rol, loading } = useAuth()
  if (loading) {
    return <p className="text-sm text-muted">Cargando…</p>
  }
  if (!mostrarAuditoria(rol)) {
    return (
      <div className="max-w-lg rounded-2xl border border-line bg-surface p-6" data-spec="W-12">
        <h2 className="text-lg font-semibold mt-1">Solo administradores</h2>
        <p className="text-sm text-muted mt-2">La bitácora de auditoría es exclusiva del admin de la empresa.</p>
      </div>
    )
  }
  return <>{children}</>
}

function RequiereModulo({ codigo, children }: { codigo: string; children: ReactNode }) {
  const { modulos } = useDominio()
  if (modulos.includes(codigo)) return <>{children}</>
  return (
    <div className="max-w-lg rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold mt-1">Este módulo no está activo</h2>
      <p className="text-sm text-muted mt-2">
        Tu empresa no tiene habilitado el módulo <code>{codigo}</code>. Un admin de plataforma puede activarlo.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar" element={<RecuperarPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <EmpresaApp />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardHome />} />
        <Route path="/visitas" element={<VisitasPage />} />
        <Route path="/personas" element={<PersonasPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/formularios" element={<FormulariosPage />} />
        <Route
          path="/mapa"
          element={
            <RequireRol>
              <Suspense fallback={<p className="text-sm text-muted">Cargando mapa…</p>}>
                <MapaPage />
              </Suspense>
            </RequireRol>
          }
        />
        <Route
          path="/solicitudes"
          element={
            <RequiereModulo codigo="solicitudes">
              <SolicitudesPage />
            </RequiereModulo>
          }
        />
        <Route
          path="/depositos"
          element={
            <RequiereModulo codigo="depositos">
              <DepositosPage />
            </RequiereModulo>
          }
        />
        <Route
          path="/cuentas"
          element={
            <RequiereModulo codigo="creditos">
              <CuentasPage />
            </RequiereModulo>
          }
        />
        <Route
          path="/kilometraje"
          element={
            <RequiereModulo codigo="kilometraje">
              <KilometrajePage />
            </RequiereModulo>
          }
        />
        <Route path="/notificaciones" element={<NotificacionesPage />} />
        <Route
          path="/auditoria"
          element={
            <RequireRol>
              <RequiereAdmin>
                <AuditoriaPage />
              </RequiereAdmin>
            </RequireRol>
          }
        />
        <Route
          path="/configuracion"
          element={
            <RequireRol>
              <CatalogosPage />
            </RequireRol>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RequireRol>
              <UsuariosPage />
            </RequireRol>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
