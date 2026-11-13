import type { SupabaseClient } from '@supabase/supabase-js'
import type { CacheCampo } from './cacheCampo'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from './catalogosTipos'
import { leerPaginado } from './paginar.ts'
import { conRespaldo, type ResultadoRespaldo } from './respaldo.ts'
import { exigirSesion } from './sesionVigente.ts'
import type { Persona } from './tipos.ts'

export type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo }

/** Tope de clientes que se descargan al teléfono para trabajar sin señal. */
export const LIMITE_PERSONAS_CAMPO = 2000

/** Clientes que la Cartera muestra con señal (igual que antes de trabajar sin señal). */
export const LIMITE_CARTERA_EN_LINEA = 200

const COLUMNAS_PERSONA = 'id, nombre, documento, documento_tipo, direccion, categoria'

/** Lo que se guarda en el teléfono: sin documento (dato sensible), solo lo necesario para agendar. */
export const COLUMNAS_PERSONA_CACHE = 'id, nombre, direccion, categoria'

export interface PersonaOpcion {
  id: number
  nombre: string
  direccion: string | null
  documento?: string | null
  documento_tipo?: string | null
  categoria?: string | null
}

export interface CatalogosCampo {
  actividades: CatalogoActividad[]
  horas: CatalogoHora[]
  zonas: ZonaCatalogo[]
  geo: GeoDefaults
  personas: PersonaOpcion[]
  aviso?: string
}

async function cargarDesdeServidor(cliente: SupabaseClient): Promise<CatalogosCampo> {
  await exigirSesion(cliente)
  const [actRes, subRes, horaRes, zonaRes, personas] = await Promise.all([
    cliente.from('actividad').select('id, nombre, activo').eq('activo', true).order('nombre'),
    cliente.from('sub_actividad').select('id, actividad_id, nombre, activo').eq('activo', true).order('nombre'),
    cliente.from('actividad_hora').select('id, nombre, cantidad, activo').eq('activo', true).order('cantidad'),
    cliente.from('zona').select('id, codigo, nombre, activo').eq('activo', true).order('nombre'),
    // PostgREST recorta a max_rows: los clientes se piden por páginas hasta el tope de campo.
    leerPaginado<PersonaOpcion>(
      async (desde, hasta) => {
        const res = await cliente
          .from('persona')
          .select(COLUMNAS_PERSONA_CACHE)
          .eq('activo', true)
          .order('nombre')
          .order('id')
          .range(desde, hasta)
        if (res.error) throw res.error
        return (res.data ?? []) as PersonaOpcion[]
      },
      { limite: LIMITE_PERSONAS_CAMPO },
    ),
  ])

  for (const res of [actRes, subRes, horaRes, zonaRes]) {
    if (res.error) throw res.error
  }

  const subs = (subRes.data ?? []) as Array<{ id: number; actividad_id: number; nombre: string; activo: boolean }>
  const actividades: CatalogoActividad[] = ((actRes.data ?? []) as Array<{ id: number; nombre: string; activo: boolean }>).map(
    (a) => ({
      ...a,
      sub_actividades: subs.filter((s) => s.actividad_id === a.id),
    }),
  )
  const horas = (horaRes.data ?? []) as CatalogoHora[]
  const zonas = (zonaRes.data ?? []) as ZonaCatalogo[]
  const geo: GeoDefaults = { horaDefaultId: horas[0]?.id ?? null }

  return {
    actividades,
    horas,
    zonas,
    geo,
    personas,
    aviso: actividades.length === 0 ? 'No hay actividades. Un admin debe cargar catálogos (W-10).' : undefined,
  }
}

export async function cargarCatalogosCampo(opts: {
  clave: string
  cache: CacheCampo
  cliente: SupabaseClient
}): Promise<CatalogosCampo & { origen: 'servidor' | 'cache'; guardadoEn?: string }> {
  const r = await conRespaldo<CatalogosCampo>({
    cargar: () => cargarDesdeServidor(opts.cliente),
    leer: () => opts.cache.leer<CatalogosCampo>(opts.clave, 'catalogos'),
    guardar: (datos) => opts.cache.guardar(opts.clave, 'catalogos', datos),
  })
  return { ...r.datos, origen: r.origen, guardadoEn: r.guardadoEn }
}

function personaDeOpcion(p: PersonaOpcion): Persona {
  return {
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion ?? null,
    documento: p.documento ?? null,
    documento_tipo: p.documento_tipo ?? 'DPI',
    categoria: p.categoria ?? null,
  }
}

/**
 * Cartera: con señal, la lista del servidor; sin señal (o sin sesión vigente), los clientes
 * guardados con los catálogos de campo. No guarda nada: esa copia la mantiene la precarga
 * de catálogos (hasta LIMITE_PERSONAS_CAMPO) y no se pisa con esta lista más corta.
 */
export async function cargarCartera(opts: {
  clave: string
  cache: CacheCampo
  cliente: SupabaseClient
}): Promise<ResultadoRespaldo<Persona[]>> {
  return conRespaldo<Persona[]>({
    cargar: async () => {
      await exigirSesion(opts.cliente)
      const { data, error } = await opts.cliente
        .from('persona')
        .select(COLUMNAS_PERSONA)
        .eq('activo', true)
        .order('nombre')
        .limit(LIMITE_CARTERA_EN_LINEA)
      if (error) throw error
      return (data ?? []) as Persona[]
    },
    leer: async () => {
      const g = await opts.cache.leer<CatalogosCampo>(opts.clave, 'catalogos')
      if (!g) return null
      return { datos: (g.datos.personas ?? []).map(personaDeOpcion), guardadoEn: g.guardadoEn }
    },
    guardar: async () => {},
  })
}
