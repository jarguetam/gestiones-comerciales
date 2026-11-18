import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { nombreComercial, varsDeBranding } from '../../lib/branding'
import { brandingPreLogin } from '../../lib/brandingPreLogin'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Alert'
import { mensajeToast } from '../../lib/erroresUi'
import {
  MSG_CAMBIO_HECHO_SIN_CONFIRMAR,
  decidirCambioClave,
  mensajeErrorCambioClave,
  validarClaveNueva,
} from './cambioClave'

type Fase = 'comprobando' | 'formulario' | 'reintentar'

function textoError(mensaje: string): string {
  const t = mensajeToast(mensaje)
  return t.descripcion ? `${t.titulo} (${t.descripcion})` : t.titulo
}

/**
 * Pantalla única mientras la sesión lleve `debe_cambiar_clave`. Solo permite
 * cambiar la contraseña o salir. Cuando el refresco trae al usuario sin marca,
 * `useAuth` recibe la sesión nueva y `RequireAuth` deja de renderizarla.
 */
export function CambioClaveObligatorio() {
  const navigate = useNavigate()
  const [fase, setFase] = useState<Fase>('comprobando')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const comprobado = useRef(false)

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

  // Una sola comprobación por montaje: nunca se re-dispara por cambios de sesión.
  useEffect(() => {
    if (comprobado.current) return
    comprobado.current = true
    void (async () => {
      try {
        const { data, error: errRefresco } = await supabase.auth.refreshSession()
        if (!errRefresco && data.user && decidirCambioClave(data.user) === 'liberar') return
      } catch {
        // Si el refresco falla se muestra el formulario.
      }
      setFase('formulario')
    })()
  }, [])

  // Solo corre tras un `updateUser` exitoso (o desde «Reintentar» en esa misma ruta):
  // la contraseña ya cambió, así que todo fallo aquí es GC-AUTH-039.
  async function refrescar() {
    setError(null)
    setOcupado(true)
    try {
      const { data, error: errRefresco } = await supabase.auth.refreshSession()
      if (errRefresco) {
        setError(textoError(MSG_CAMBIO_HECHO_SIN_CONFIRMAR))
        setFase('reintentar')
        return
      }
      if (data.user && decidirCambioClave(data.user) === 'liberar') return
      console.warn('El servidor no quitó debe_cambiar_clave tras el cambio de contraseña: ¿falta el trigger trg_borrar_marca_cambio_clave?')
      setError(textoError(MSG_CAMBIO_HECHO_SIN_CONFIRMAR))
      setFase('reintentar')
    } catch {
      setError(textoError(MSG_CAMBIO_HECHO_SIN_CONFIRMAR))
      setFase('reintentar')
    } finally {
      setOcupado(false)
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const invalida = validarClaveNueva(nueva, confirmar)
    if (invalida) {
      setError(textoError(invalida))
      return
    }
    setError(null)
    setOcupado(true)
    try {
      const { error: errUpdate } = await supabase.auth.updateUser({ password: nueva })
      if (errUpdate) {
        setError(textoError(mensajeErrorCambioClave(errUpdate)))
        setOcupado(false)
        return
      }
    } catch (err) {
      setError(textoError(mensajeErrorCambioClave(err as { message?: string })))
      setOcupado(false)
      return
    }
    setOcupado(false)
    await refrescar()
  }

  async function salir() {
    // signOut() devuelve { error } y no lanza; igual que AppShell, se sale siempre.
    const { error: errSalida } = await supabase.auth.signOut()
    if (errSalida) console.warn('No se pudo cerrar la sesión en el servidor', errSalida)
    navigate('/login', { replace: true })
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-canvas p-6"
      data-spec="W-01b"
      style={varsDeBranding(branding) as CSSProperties}
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8">
        <div className="flex items-center gap-3">
          <BrandMark nombre={marca} logoUrl={branding.logo_url} />
          <div>
            <h1 className="text-xl font-semibold text-ink">Cambia tu contraseña</h1>
            <p className="text-sm text-muted">{marca}</p>
          </div>
        </div>

        {fase === 'comprobando' && (
          <p className="mt-6 text-sm text-muted" role="status">
            Comprobando tu sesión…
          </p>
        )}

        {fase === 'formulario' && (
          <form onSubmit={(e) => void guardar(e)} className="mt-6 space-y-4">
            <p className="text-sm text-muted">
              Entraste con una contraseña temporal. Elige una nueva para continuar.
            </p>
            <Input
              id="clave-nueva"
              label="Contraseña nueva"
              type="password"
              autoComplete="new-password"
              required
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <Input
              id="clave-confirmar"
              label="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Button type="submit" size="lg" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </form>
        )}

        {fase === 'reintentar' && (
          <div className="mt-6 space-y-4">
            {error && <Alert tone="danger" role="alert">{error}</Alert>}
            <Button size="lg" disabled={ocupado} onClick={() => void refrescar()}>
              {ocupado ? 'Reintentando…' : 'Reintentar'}
            </Button>
          </div>
        )}

        <div className="mt-4">
          <Button variant="ghost" onClick={() => void salir()}>
            Salir
          </Button>
        </div>
      </div>
    </div>
  )
}
