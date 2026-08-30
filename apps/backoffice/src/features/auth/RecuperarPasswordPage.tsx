import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Input } from '../../components/ui'
import { formatError } from '../../lib/erroresUi'
import { BACKEND_CONFIGURADO, supabase } from '../../lib/supabase'
import { actualizarPassword, solicitarReset } from './recuperar'

export function RecuperarPasswordPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState<'pedir' | 'nueva'>('pedir')
  const [ok, setOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!BACKEND_CONFIGURADO) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setModo('nueva')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function handlePedir(e: React.FormEvent) {
    e.preventDefault()
    if (!BACKEND_CONFIGURADO) {
      setError('GC-CORE-001')
      return
    }
    setError(null)
    setOk(null)
    setLoading(true)
    try {
      await solicitarReset(email, supabase)
      setOk('Revisá tu correo. Te enviamos un enlace para elegir una contraseña nueva.')
    } catch (err) {
      const f = formatError(err)
      setError(f.code ? `${f.message} (${f.code})` : f.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleNueva(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    setLoading(true)
    try {
      await actualizarPassword(password, supabase)
      setOk('Contraseña actualizada. Ya podés ingresar.')
    } catch (err) {
      const f = formatError(err)
      setError(f.code ? `${f.message} (${f.code})` : f.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-spec="P-01">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-muted">
          {modo === 'nueva'
            ? 'Elegí una contraseña nueva para tu cuenta de plataforma.'
            : 'Te mandamos un enlace al correo si la cuenta existe.'}
        </p>
        {!BACKEND_CONFIGURADO && (
          <div className="mt-4">
            <Alert tone="danger" role="alert">
              Falta la configuración pública (GC-CORE-001).
            </Alert>
          </div>
        )}
        {modo === 'pedir' ? (
          <form onSubmit={(e) => void handlePedir(e)} className="mt-6 space-y-4">
            <Input
              id="email-recuperar"
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            )}
            {ok && (
              <Alert tone="success" role="status">
                {ok}
              </Alert>
            )}
            <Button type="submit" size="lg" disabled={loading || !BACKEND_CONFIGURADO}>
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleNueva(e)} className="mt-6 space-y-4">
            <Input
              id="password-nueva"
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            )}
            {ok && (
              <Alert tone="success" role="status">
                {ok}
              </Alert>
            )}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </form>
        )}
        <p className="mt-6 text-sm">
          <Link to="/login" className="text-primary underline-offset-2 hover:underline">
            Volver al ingreso
          </Link>
        </p>
      </div>
    </div>
  )
}
