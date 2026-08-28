import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '../features/auth/Login'
import { Empresas } from '../features/empresas/Empresas'
import { EmpresaDetalle } from '../features/empresas/EmpresaDetalle'
import { CatalogosPage } from '../features/catalogos/CatalogosPage'
import { SaludPage } from '../features/salud/SaludPage'
import { RequireAuth } from './RequireAuth'
import { BackofficeShell } from './BackofficeShell'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <BackofficeShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Empresas />} />
        <Route path="/empresas/:id" element={<EmpresaDetalle />} />
        <Route path="/catalogos" element={<CatalogosPage />} />
        <Route path="/salud" element={<SaludPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
