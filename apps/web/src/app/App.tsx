import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '../features/auth/Login'
import { Dashboard } from '../features/dashboard/Dashboard'
import { RequireAuth } from './RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
