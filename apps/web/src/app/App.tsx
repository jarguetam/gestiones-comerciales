import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Login } from '../features/auth/Login'
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
import { MapaPage } from '../features/mapa/MapaPage'
import { AuditoriaPage } from '../features/auditoria/AuditoriaPage'
import { NotificacionesPage } from '../features/notificaciones/NotificacionesPage'
import { useDominio } from './DominioContext'
import { DEMO_MODE } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'
import { mostrarAuditoria } from '../lib/claims'

function RequiereAdmin({ children }: { children: ReactNode }) {
  const { rol } = useAuth()
  if (!mostrarAuditoria(rol, DEMO_MODE)) {
    return (
      <div className="max-w-lg rounded-2xl border border-[#E4DCC8] bg-white p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-12</p>
        <h2 className="font-serif text-2xl mt-1">Solo administradores</h2>
        <p className="text-sm text-slate-600 mt-2">La bitácora de auditoría es exclusiva del admin de la empresa.</p>
      </div>
    )
  }
  return <>{children}</>
}

function RequiereModulo({ codigo, children }: { codigo: string; children: ReactNode }) {
  const { modulos, fuente } = useDominio()
  if (DEMO_MODE || fuente === 'demo' || modulos.includes(codigo)) return <>{children}</>
  return (
    <div className="max-w-lg rounded-2xl border border-[#E4DCC8] bg-white p-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">Módulo inactivo</p>
      <h2 className="font-serif text-2xl mt-1">Este módulo no está activo</h2>
      <p className="text-sm text-slate-600 mt-2">
        Tu empresa no tiene habilitado el módulo <code>{codigo}</code>. Un admin de plataforma puede activarlo.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="/mapa" element={<MapaPage />} />
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
            <RequiereAdmin>
              <AuditoriaPage />
            </RequiereAdmin>
          }
        />
        <Route path="/configuracion" element={<CatalogosPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
