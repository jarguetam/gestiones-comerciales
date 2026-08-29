import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { etiquetaFactor } from './mfa'

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
    <div className="p-6 max-w-xl space-y-4">
      <p className="text-xs uppercase tracking-widest text-teal-700">P-01 · seguridad</p>
      <h1 className="text-2xl font-bold text-slate-900">MFA TOTP</h1>
      <p className="text-sm text-slate-600">
        Enrolá un autenticador para exigir un segundo factor al entrar al backoffice.
      </p>
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{aviso}</p>}

      <div className="rounded-lg bg-white p-4 shadow space-y-3">
        <h2 className="font-medium">Factores</h2>
        {factors.length === 0 ? (
          <p className="text-sm text-slate-500">Ningún factor enrolado.</p>
        ) : (
          <ul className="space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{etiquetaFactor(f)}</span>
                <button
                  type="button"
                  onClick={() => void desenrolar(f.id)}
                  className="text-red-700 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => void enrolar()}
          disabled={loading || !!qr}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? 'Generando…' : 'Enrolar TOTP'}
        </button>
      </div>

      {qr && (
        <form onSubmit={(e) => void verificar(e)} className="rounded-lg bg-white p-4 shadow space-y-3">
          <h2 className="font-medium">Verificar enrolamiento</h2>
          <img src={qr} alt="QR TOTP" className="mx-auto h-40 w-40 bg-white" />
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código de 6 dígitos"
            className="w-full rounded-md border border-slate-300 px-3 py-2 tracking-widest"
            required
          />
          <button type="submit" disabled={loading} className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {loading ? 'Verificando…' : 'Confirmar código'}
          </button>
        </form>
      )}
    </div>
  )
}
