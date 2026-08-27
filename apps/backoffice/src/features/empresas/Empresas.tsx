import { useAuth } from '../auth/useAuth'

export function Empresas() {
  const { session } = useAuth()
  const email = session?.user?.email ?? '—'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-white">GC Platform — Empresas</h1>
          <span className="text-sm text-slate-300">{email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <p className="text-gray-600">
          CRUD de tenants, alta con wizard (rubro, plan, branding, módulos), salud por empresa.
          Vista P-02 del spec frontend. Implementación en F1.
        </p>
      </main>
    </div>
  )
}
