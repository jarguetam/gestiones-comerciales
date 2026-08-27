import { useAuth } from '../auth/useAuth'

export function Dashboard() {
  const { session, demo } = useAuth()
  const email = session?.user?.email ?? (demo ? 'demo@preview' : '—')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gc-primary">Gestiones Comerciales</h1>
          <span className="text-sm text-gray-600">{email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        {demo && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Preview estático F1 — los datos reales se sirven de Supabase cuando la app
            se conecta con las variables de entorno.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta titulo="Visitas programadas" valor="—" nota="W-02 · dashboard_supervisor()" />
          <Tarjeta titulo="Visitas completadas" valor="—" nota="% del día" />
          <Tarjeta titulo="Depósitos pendientes" valor="—" nota="módulo depositos" />
          <Tarjeta titulo="Asesores activos" valor="—" nota="estructura_comercial()" />
        </div>
        <p className="mt-6 text-gray-600">
          Dashboard del día. KPIs de visitas, depósitos y estructura comercial (F1).
        </p>
      </main>
    </div>
  )
}

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{valor}</p>
      <p className="mt-1 text-xs text-gray-400">{nota}</p>
    </div>
  )
}
