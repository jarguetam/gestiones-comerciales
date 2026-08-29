import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { BRANDING_DEMO, nombreComercial, varsDeBranding } from '../../lib/branding'
import { brandingPreLogin } from '../../lib/brandingPreLogin'
import { requierePasoTotp } from './mfa'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Alert'
import { mensajeToast } from '../../lib/erroresUi'
import type { CSSProperties } from 'react'

/**
 * Login (W-01).
 * Gap: no hay RPC público host/codigo → tenant.branding (RLS tenant_select es
 * authenticated). No se enumeran tenants al cliente. Pre-sesión: ?tenant=,
 * localStorage de la última sesión (host/codigo) y DEMO.
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
        demo: DEMO_MODE,
        host: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
        search: typeof window !== 'undefined' ? window.location.search : '',
        hash: typeof window !== 'undefined' ? window.location.hash : '',
      }),
    [],
  )
  const marca = nombreComercial(branding, DEMO_MODE ? nombreComercial(BRANDING_DEMO, 'Gestiones Comerciales') : 'Gestiones Comerciales')

  async function handlePassword(e: React.FormEvent) {
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
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (requierePasoTotp(aal)) {
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

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-6" data-spec="W-01" style={varsDeBranding(branding) as CSSProperties}>
      <div className="w-full max-w-md rounded-2xl bg-canvas p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <BrandMark nombre={marca} logoUrl={branding.logo_url} />
          <div>
            <h1 className="font-serif text-3xl text-ink">Gestiones Comerciales</h1>
            <p className="text-sm text-muted">{marca}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {paso === 'totp' ? 'Confirmá el código TOTP de tu autenticador.' : 'Entrá a la operación de tu empresa.'}
        </p>
        {DEMO_MODE && (
          <div className="mt-4">
            <Alert tone="warning">Preview sin backend: el ingreso abre el tablero con datos de demostración.</Alert>
          </div>
        )}
        {paso === 'password' ? (
          <form onSubmit={(e) => void handlePassword(e)} className="mt-6 space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="username"
              required={!DEMO_MODE}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required={!DEMO_MODE}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Ingresando…' : DEMO_MODE ? 'Entrar al tablero' : 'Ingresar'}
            </Button>
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
