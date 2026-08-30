import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Alert, BrandMark, Button, Input } from '../../components/ui'

export function ChallengeMfaPage() {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: factors, error: errF } = await supabase.auth.mfa.listFactors()
      if (errF) throw errF
      const totp = factors?.totp?.[0]
      if (!totp) throw new Error('GC-AUTH-002: MFA requerido sin factor TOTP')
      const { data: challenge, error: errC } = await supabase.auth.mfa.challenge({ factorId: totp.id })
      if (errC) throw errC
      const { error } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: codigo.trim(),
      })
      if (error) throw error
      window.location.reload()
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
          <h1 className="text-xl font-semibold text-ink">Verificar MFA</h1>
        </div>
        <p className="mb-6 text-center text-sm text-muted">Confirmá el código TOTP de tu autenticador.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input
            id="totp-challenge"
            label="Código MFA"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="tracking-widest"
          />
          {error && (
            <Alert tone="danger" role="alert">
              {error}
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Verificando…' : 'Verificar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
