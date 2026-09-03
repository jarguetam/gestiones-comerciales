import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BACKEND_CONFIGURADO, SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase'
import { varsFaltantesSupabase } from '../../lib/supabaseEnv'
import { nombreComercial, varsDeBranding } from '../../lib/branding'
import { brandingPreLogin } from '../../lib/brandingPreLogin'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Alert'
import { mensajeToast } from '../../lib/erroresUi'
import { loginConAuthGuard } from '../../lib/authGuardLogin'
import type { CSSProperties } from 'react'

/**
 * Login (W-01). Sin sesión demo: exige backend + credenciales reales.
 */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [paso, setPaso] = useState<'password' | 'totp'>('password')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const branding = useMemo(
    () =>
      brandingPreLogin({
        demo: false,
        host: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
        search: typeof window !== 'undefined' ? window.location.search : '',
        hash: typeof window !== 'undefined' ? window.location.hash : '',
      }),
    [],
  )
  const marca = nombreComercial(branding, 'Gestiones Comerciales')
  const faltantes = varsFaltantesSupabase(SUPABASE_URL, SUPABASE_ANON_KEY, {
    url: 'VITE_SUPABASE_URL',
    key: 'VITE_SUPABASE_ANON_KEY',
  })

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!BACKEND_CONFIGURADO) {
      setError('GC-CORE-001')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { requiresMfa } = await loginConAuthGuard(supabase, email, password)
      if (requiresMfa) {
        const { data: factors, error: errF } = await supabase.auth.mfa.listFactors()
        if (errF) throw errF
        const totp = factors?.totp?.[0]
        if (!totp) throw new Error('GC-AUTH-002: MFA requerido sin factor TOTP')
        const { data: challenge, error: errC } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (errC) throw errC
        setFactorId(totp.id)
        setChallengeId(challenge.id)
        setPaso('totp')
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      const t = mensajeToast(err)
      setError(t.descripcion ? `${t.titulo} (${t.descripcion})` : t.titulo)
    } finally {
      setLoading(false)
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (!factorId || !challengeId) throw new Error('GC-AUTH-002: desafío MFA incompleto')
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: codigo.trim() })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      const t = mensajeToast(err)
      setError(t.descripcion ? `${t.titulo} (${t.descripcion})` : t.titulo)
    } finally {
      setLoading(false)
    }
  }

  const avisoConfig = BACKEND_CONFIGURADO
    ? null
    : `Faltan ${faltantes.join(' y ') || 'VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY'} (GC-CORE-001).`

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-spec="W-01" style={varsDeBranding(branding) as CSSProperties}>
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8">
        <div className="flex items-center gap-3">
          <BrandMark nombre={marca} logoUrl={branding.logo_url} />
          <div>
            <h1 className="text-xl font-semibold text-ink">Ruta de campo</h1>
            <p className="text-sm text-muted">{marca}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {paso === 'totp' ? 'Confirmá el código TOTP de tu autenticador.' : 'Entrá a la jornada de tu empresa.'}
        </p>
        {avisoConfig && (
          <div className="mt-4">
            <Alert tone="danger" role="alert">
              {avisoConfig}
            </Alert>
          </div>
        )}
        {paso === 'password' ? (
          <form onSubmit={(e) => void handlePassword(e)} className="mt-6 space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Button type="submit" size="lg" disabled={loading || !BACKEND_CONFIGURADO}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
            <p className="text-sm">
              <Link to="/recuperar" className="text-primary underline-offset-2 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
            <p className="text-center text-sm text-muted">
              <a href="privacidad.html" className="underline text-ink">Privacidad</a>
            </p>
          </form>
        ) : (
          <form onSubmit={(e) => void handleTotp(e)} className="mt-6 space-y-4">
            <Input
              id="totp"
              label="Código MFA"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="tracking-widest"
            />
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Verificando…' : 'Verificar'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
