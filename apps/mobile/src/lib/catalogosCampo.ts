import type { CacheCampo } from './cacheCampo'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from './catalogosTipos'
import { conRespaldo } from './respaldo.ts'

export type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo }

/** Tope de clientes que se descargan al teléfono para trabajar sin señal. */
export const LIMITE_PERSONAS_CAMPO = 2000

export interface PersonaOpcion {
  id: number
  nombre: string
  direccion: string | null
}

export interface CatalogosCampo {
  actividades: CatalogoActividad[]
  horas: CatalogoHora[]
  zonas: ZonaCatalogo[]
  geo: GeoDefaults
  personas: PersonaOpcion[]
  aviso?: string
}

async function cargarDesdeServidor(): Promise<CatalogosCampo> {
  // Import diferido: el módulo del cliente Supabase exige entorno de Expo.
  const { supabase } = await import('./supabase')
  const [actRes, subRes, horaRes, zonaRes, persRes] = await Promise.all([
    supabase.from('actividad').select('id, nombre, activo').eq('activo', true).order('nombre'),
    supabase.from('sub_actividad').select('id, actividad_id, nombre, activo').eq('activo', true).order('nombre'),
    supabase.from('actividad_hora').select('id, nombre, cantidad, activo').eq('activo', true).order('cantidad'),
    supabase.from('zona').select('id, codigo, nombre, activo').eq('activo', true).order('nombre'),
    supabase
      .from('persona')
      .select('id, nombre, direccion')
      .eq('activo', true)
      .order('nombre')
      .limit(LIMITE_PERSONAS_CAMPO),
  ])

  for (const res of [actRes, subRes, horaRes, zonaRes, persRes]) {
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
    personas: (persRes.data ?? []) as PersonaOpcion[],
    aviso: actividades.length === 0 ? 'No hay actividades. Un admin debe cargar catálogos (W-10).' : undefined,
  }
}

export async function cargarCatalogosCampo(opts: {
  clave: string
  cache: CacheCampo
}): Promise<CatalogosCampo & { origen: 'servidor' | 'cache'; guardadoEn?: string }> {
  const r = await conRespaldo<CatalogosCampo>({
    cargar: cargarDesdeServidor,
    leer: () => opts.cache.leer<CatalogosCampo>(opts.clave, 'catalogos'),
    guardar: (datos) => opts.cache.guardar(opts.clave, 'catalogos', datos),
  })
  return { ...r.datos, origen: r.origen, guardadoEn: r.guardadoEn }
}
