import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '../features/auth/Login'
import { RequireAuth } from './RequireAuth'
import { EmpresaApp } from './EmpresaApp'
import { DashboardHome } from '../features/dashboard/DashboardHome'
import { VisitasPage } from '../features/visitas/VisitasPage'
import { PersonasPage } from '../features/personas/PersonasPage'
import { CrmPage } from '../features/crm/CrmPage'
import { NotificationsView } from '../features/calendar/components/NotificationsView'
import { useDominio } from './DominioContext'

function NotificacionesPage() {
  const { abrirNuevaVisita } = useDominio()
  return (
    <div className="max-w-xl h-[calc(100vh-8rem)] rounded-2xl border border-[#E4DCC8] overflow-hidden bg-white relative">
      <NotificationsView
        embedded
        onOpenNewEvent={() => abrirNuevaVisita()}
        onNavigateTab={() => undefined}
      />
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
        <Route path="/notificaciones" element={<NotificacionesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
