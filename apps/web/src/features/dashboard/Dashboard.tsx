import { useAuth } from '../auth/useAuth'

export function Dashboard() {
  const { session } = useAuth()
  const email = session?.user?.email ?? '—'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gc-primary">Gestiones Comerciales</h1>
          <span className="text-sm text-gray-600">{email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <p className="text-gray-600">
          Dashboard del día. KPIs de visitas, depósitos y estructura comercial (F1).
        </p>
      </main>
    </div>
  )
}
