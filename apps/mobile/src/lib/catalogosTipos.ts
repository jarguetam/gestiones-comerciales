export interface CatalogoSubActividad {
  id: number
  nombre: string
  activo?: boolean
}

export interface CatalogoActividad {
  id: number
  nombre: string
  activo?: boolean
  sub_actividades: CatalogoSubActividad[]
}

export interface CatalogoHora {
  id: number
  nombre: string
  cantidad: number
  activo?: boolean
}

export interface ZonaCatalogo {
  id: number
  codigo: string
  nombre: string
  activo?: boolean
}

export interface GeoDefaults {
  zonaId: number | null
  departamentoId: number | null
  municipioId: number | null
  horaDefaultId: number | null
}
