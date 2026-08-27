import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_MODE, supabase } from '../../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (DEMO_MODE) {
        navigate('/', { replace: true })
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1B2430] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-[#F3EEE4] p-8 shadow-xl">
        <p className="text-[10px] uppercase tracking-[0.22em] text-brand-700">Ruta de campo</p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">Gestiones Comerciales</h1>
        <p className="mt-1 text-sm text-slate-600">Entrá a la operación de tu empresa.</p>
        {DEMO_MODE && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Preview sin backend: el ingreso abre el tablero con datos de demostración.
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required={!DEMO_MODE}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required={!DEMO_MODE}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-700 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Ingresando…' : DEMO_MODE ? 'Entrar al tablero' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
