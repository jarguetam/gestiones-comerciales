import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { etiquetaFactor } from './mfa'
import { Alert, Button, EmptyState, Input, PAGE, PageHeader } from '../../components/ui'

interface FactorTotp {
  id: string
  friendlyName?: string
  status: string
}

export function MfaPage() {
  const [factors, setFactors] = useState<FactorTotp[]>([])
  const [qr, setQr] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setFactors([{ id: 'demo', friendlyName: 'Authy (demo)', status: 'verified' }])
      return
    }
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setError(error.message)
      return
    }
    setFactors((data?.totp ?? []) as FactorTotp[])
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function enrolar() {
    setError(null)
    setAviso(null)
    setLoading(true)
    try {
      if (DEMO_MODE) {
        setQr('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#0f172a"/><text x="60" y="64" fill="#5eead4" text-anchor="middle" font-size="11">DEMO QR</text></svg>'))
        setFactorId('demo-enroll')
        setAviso('Preview: escaneá el QR de demostración y verificá con cualquier código.')
        return
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'GC Backoffice',
      })
      if (error) throw error
      setFactorId(data.id)
      setQr(data.totp.qr_code)
      setAviso('Escaneá el QR en tu autenticador y confirmá con el código de 6 dígitos.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enrolar MFA')
    } finally {
      setLoading(false)
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    setLoading(true)
    try {
      if (DEMO_MODE) {
        setQr(null)
        setFactorId(null)
        setCodigo('')
        setAviso('Factor TOTP verificado (demo).')
        await cargar()
        return
      }
      if (!factorId) throw new Error('GC-AUTH-002: no hay factor pendiente')
      const { data: challenge, error: errC } = await supabase.auth.mfa.challenge({ factorId })
      if (errC) throw errC
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: codigo.trim(),
      })
      if (error) throw error
      setQr(null)
      setFactorId(null)
      setCodigo('')
      setAviso('MFA TOTP activo.')
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código MFA inválido')
    } finally {
      setLoading(false)
    }
  }

  async function desenrolar(id: string) {
    setError(null)
    setAviso(null)
    try {
      if (DEMO_MODE) {
        setFactors((f) => f.filter((x) => x.id !== id))
        setAviso('Factor eliminado (demo).')
        return
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
      if (error) throw error
      setAviso('Factor eliminado.')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el factor')
    }
  }

  return (
    <div className={`${PAGE} max-w-xl`}>
      <PageHeader
        spec="P-01"
        title="MFA TOTP"
        description="Enrolá un autenticador para exigir un segundo factor al entrar al backoffice."
      />
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {aviso && <Alert tone="success">{aviso}</Alert>}

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-medium text-ink">Factores</h2>
        {factors.length === 0 ? (
          <EmptyState titulo="Ningún factor enrolado." />
        ) : (
          <ul className="space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{etiquetaFactor(f)}</span>
                <Button variant="ghost" size="sm" onClick={() => void desenrolar(f.id)}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={() => void enrolar()} disabled={loading || !!qr}>
          {loading ? 'Generando…' : 'Enrolar TOTP'}
        </Button>
      </div>

      {qr && (
        <form onSubmit={(e) => void verificar(e)} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-medium text-ink">Verificar enrolamiento</h2>
          <img src={qr} alt="QR TOTP" className="mx-auto h-40 w-40 bg-surface" />
          <Input
            id="totp-enrolar"
            label="Código MFA"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código de 6 dígitos"
            className="tracking-widest"
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Verificando…' : 'Confirmar código'}
          </Button>
        </form>
      )}
    </div>
  )
}
