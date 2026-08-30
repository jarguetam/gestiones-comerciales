import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BACKEND_CONFIGURADO, supabase } from '../../lib/supabase'
import { requierePasoTotp } from './mfa'
import { Alert, BrandMark, Button, Input } from '../../components/ui'

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

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!BACKEND_CONFIGURADO) {
      setError('GC-CORE-001')
      return
    }
    setError(null)
    setLoading(true)
    try {
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
      setError(err instanceof Error ? err.message : 'Error de autenticación')
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
      setError(err instanceof Error ? err.message : 'Código MFA inválido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-spec="P-01">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8">
        <div className="mb-4 flex items-center justify-center gap-2">
          <BrandMark nombre="GC Platform" />
          <h1 className="text-xl font-semibold text-ink">GC Platform</h1>
        </div>
        <p className="mb-6 text-center text-sm text-muted">
          {paso === 'totp' ? 'Confirmá el código TOTP de tu autenticador.' : 'Backoffice de plataforma'}
        </p>
        {!BACKEND_CONFIGURADO && (
          <div className="mb-4">
            <Alert tone="danger" role="alert">
              Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY (GC-CORE-001).
            </Alert>
          </div>
        )}
        {paso === 'password' ? (
          <form onSubmit={(e) => void handlePassword(e)} className="space-y-4">
            <Input id="email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input id="password" label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Button type="submit" size="lg" disabled={loading || !BACKEND_CONFIGURADO}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleTotp(e)} className="space-y-4">
            <Input id="totp" label="Código MFA" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} className="tracking-widest" />
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
