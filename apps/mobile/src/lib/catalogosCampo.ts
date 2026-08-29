import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from './catalogosTipos'
import { supabase } from './supabase'

export type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo }

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

export async function cargarCatalogosCampo(): Promise<CatalogosCampo> {
  const [actRes, subRes, horaRes, zonaRes, deptoRes, muniRes, persRes] = await Promise.all([
    supabase.from('actividad').select('id, nombre, activo').eq('activo', true).order('nombre'),
    supabase.from('sub_actividad').select('id, actividad_id, nombre, activo').eq('activo', true).order('nombre'),
    supabase.from('actividad_hora').select('id, nombre, cantidad, activo').eq('activo', true).order('cantidad'),
    supabase.from('zona').select('id, codigo, nombre, activo').eq('activo', true).order('nombre'),
    supabase.from('departamento').select('id, nombre').limit(1).maybeSingle(),
    supabase.from('municipio').select('id, nombre').limit(1).maybeSingle(),
    supabase.from('persona').select('id, nombre, direccion').eq('activo', true).order('nombre').limit(200),
  ])

  const errores = [actRes.error, subRes.error, horaRes.error, zonaRes.error, persRes.error]
    .filter(Boolean)
    .map((e) => e!.message)

  const subs = (subRes.data ?? []) as Array<{ id: number; actividad_id: number; nombre: string; activo: boolean }>
  const actividades: CatalogoActividad[] = ((actRes.data ?? []) as Array<{ id: number; nombre: string; activo: boolean }>).map(
    (a) => ({
      ...a,
      sub_actividades: subs.filter((s) => s.actividad_id === a.id),
    }),
  )
  const horas = (horaRes.data ?? []) as CatalogoHora[]
  const zonas = (zonaRes.data ?? []) as ZonaCatalogo[]
  const geo: GeoDefaults = {
    zonaId: zonas[0]?.id ?? null,
    departamentoId: (deptoRes.data as { id?: number } | null)?.id ?? null,
    municipioId: (muniRes.data as { id?: number } | null)?.id ?? null,
    horaDefaultId: horas[0]?.id ?? null,
  }

  let aviso: string | undefined
  if (errores.length) aviso = errores[0]
  else if (actividades.length === 0) aviso = 'No hay actividades. Un admin debe cargar catálogos (W-10).'
  else if (!geo.zonaId || !geo.departamentoId || !geo.municipioId) {
    aviso = 'GC-VIS-002: faltan zona o geografía del tenant'
  }

  return {
    actividades,
    horas,
    zonas,
    geo,
    personas: (persRes.data ?? []) as PersonaOpcion[],
    aviso,
  }
}
