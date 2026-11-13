/**
 * Hidratación del perfil con respaldo sin señal (sin dependencias de Expo, para poder probarla).
 * - Error transitorio (red, JWT vencido): se usa la última copia guardada.
 * - Error no transitorio en una lectura: GC-AUTH-023, perfil degradado desde claims (el login no
 *   depende de esas lecturas, GC-AUTH-022).
 * - Sin señal y sin copia (GC-NET-002): perfil degradado desde claims.
 */
import type { BrandingTenant } from './branding.ts'
import { brandingDeJson, nombreComercial } from './branding.ts'
import type { CacheCampo } from './cacheCampo.ts'
import type { Rol } from './claims'
import { esErrorTransitorio } from './errorRed.ts'
import { modulosDeFilas, perfilDesdeFuentes, type Perfil } from './perfil.ts'
import { conRespaldo } from './respaldo.ts'

interface Lectura {
  data: unknown
  error: unknown
}

export interface FuentesPerfil {
  usuario: Lectura
  tenant: Lectura
  modulos: Lectura
}

export interface EntradaPerfil {
  userId: string
  email?: string | null
  userMetadata?: Record<string, unknown> | null
  claims: { tenantId: string; rol: Rol }
  clave: string
  cache: CacheCampo
  leerFuentes: () => Promise<FuentesPerfil>
  advertir?: (mensaje: string, detalle: unknown) => void
}

export async function resolverPerfil(e: EntradaPerfil): Promise<Perfil> {
  const advertir = e.advertir ?? ((m: string, d: unknown) => console.warn(m, d))
  const degradado = (): Perfil =>
    perfilDesdeFuentes({ userId: e.userId, claims: e.claims, email: e.email, userMetadata: e.userMetadata })
  let esDegradado = false
  try {
    const { datos } = await conRespaldo<Perfil>({
      cargar: async () => {
        const f = await e.leerFuentes()
        const errores = [f.usuario.error, f.tenant.error, f.modulos.error].filter((x) => x)
        const transitorio = errores.find((x) => esErrorTransitorio(x))
        if (transitorio) throw transitorio
        if (errores.length > 0) {
          advertir('GC-AUTH-023: lectura de perfil fallida', errores[0])
          esDegradado = true
          return degradado()
        }
        const tenant = f.tenant.data as { nombre?: string; branding?: unknown } | null
        const branding: BrandingTenant = brandingDeJson(tenant?.branding)
        return perfilDesdeFuentes({
          userId: e.userId,
          claims: e.claims,
          usuario: f.usuario.data as { id: string; nombre: string } | null,
          tenantNombre: nombreComercial(branding, tenant?.nombre ?? 'Gestiones Comerciales'),
          branding,
          modulos: modulosDeFilas(f.modulos.data as Parameters<typeof modulosDeFilas>[0]),
          email: e.email,
          userMetadata: e.userMetadata,
        })
      },
      leer: () => e.cache.leer<Perfil>(e.clave, 'perfil'),
      advertir,
      // Un perfil degradado no debe pisar una copia completa anterior.
      guardar: async (p) => {
        if (!esDegradado) await e.cache.guardar(e.clave, 'perfil', p)
      },
    })
    return datos
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('GC-NET-002')) {
      advertir('GC-NET-002: sin conexión ni perfil guardado, perfil degradado', err)
      return degradado()
    }
    throw err
  }
}
