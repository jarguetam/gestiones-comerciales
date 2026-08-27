import { useAuth } from '../auth/useAuth'

export function Empresas() {
  const { session, demo } = useAuth()
  const email = session?.user?.email ?? (demo ? 'demo@preview' : '—')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-white">GC Platform — Empresas</h1>
          <span className="text-sm text-slate-300">{email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        {demo && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Preview estático F1 — las empresas se administran vía RPC admin_* al conectar el backend.
          </p>
        )}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Rubro</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <Fila nombre="—" rubro="—" plan="—" estado="—" />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-gray-600">
          Vista P-02 del spec frontend. CRUD de tenants con wizard de alta (rubro → branding →
          módulos → seed → primer admin). Implementación en F1.
        </p>
      </main>
    </div>
  )
}

function Fila({
  nombre,
  rubro,
  plan,
  estado,
}: {
  nombre: string
  rubro: string
  plan: string
  estado: string
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-800">{nombre}</td>
      <td className="px-4 py-3">{rubro}</td>
      <td className="px-4 py-3">{plan}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{estado}</span>
      </td>
    </tr>
  )
}
