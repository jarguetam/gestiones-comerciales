/** Tipos y helpers de P-05 — catálogos globales (geografía, módulos, plantillas). */

export interface Departamento {
  id: number
  nombre: string
}

export interface Municipio {
  id: number
  departamento_id: number
  nombre: string
}

export interface ModuloCatalogo {
  id: number
  codigo: string
  nombre: string
  nucleo: boolean
}

export type TipoPlantilla = 'actividad' | 'formulario' | 'hora'

export interface PlantillaBase {
  id: number
  rubro: string
  tipo: TipoPlantilla
  nombre: string
  payload: Record<string, unknown>
  activo: boolean
}

export const RUBROS_PLANTILLA = [
  { codigo: 'agro', nombre: 'Microfinanzas' },
  { codigo: 'distribuidora', nombre: 'Distribución' },
  { codigo: 'farmaceutica', nombre: 'Farmacéutica' },
  { codigo: 'generico', nombre: 'Genérico' },
] as const

export const TIPOS_PLANTILLA: { codigo: TipoPlantilla; nombre: string }[] = [
  { codigo: 'actividad', nombre: 'Actividad' },
  { codigo: 'formulario', nombre: 'Formulario' },
  { codigo: 'hora', nombre: 'Duración' },
]

export interface FilaGeografia {
  departamento: string
  municipio: string
}

/** Parsea CSV `departamento,municipio` (con o sin encabezado). */
export function parseCsvGeografia(texto: string): FilaGeografia[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
  if (lineas.length === 0) {
    throw new Error('GC-CAT-001: el CSV está vacío')
  }
  const encabezado = lineas[0].toLowerCase()
  const inicio = encabezado.includes('departamento') && encabezado.includes('municipio') ? 1 : 0
  if (inicio === 1 && lineas.length === 1) {
    throw new Error('GC-CAT-001: el CSV no tiene filas de datos')
  }
  const filas: FilaGeografia[] = []
  for (let i = inicio; i < lineas.length; i++) {
    const partes = splitCsvLine(lineas[i])
    if (partes.length < 2) {
      throw new Error(`GC-CAT-001: fila ${i + 1} inválida (se espera departamento,municipio)`)
    }
    const departamento = partes[0].trim()
    const municipio = partes[1].trim()
    if (!departamento || !municipio) {
      throw new Error(`GC-CAT-001: fila ${i + 1} con departamento o municipio vacío`)
    }
    filas.push({ departamento, municipio })
  }
  return filas
}

function splitCsvLine(linea: string): string[] {
  const out: string[] = []
  let actual = ''
  let enComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        enComillas = !enComillas
      }
    } else if (c === ',' && !enComillas) {
      out.push(actual.replace(/^"|"$/g, ''))
      actual = ''
    } else {
      actual += c
    }
  }
  out.push(actual.replace(/^"|"$/g, ''))
  return out
}

export function validarPayloadPlantilla(
  tipo: TipoPlantilla,
  payload: Record<string, unknown>,
): string | null {
  if (tipo === 'actividad') {
    const subs = payload.sub_actividades
    if (subs === undefined) return null
    if (!Array.isArray(subs) || subs.some((s) => typeof s !== 'string')) {
      return 'GC-CAT-001: sub_actividades debe ser una lista de textos'
    }
    return null
  }
  if (tipo === 'hora') {
    const cantidad = Number(payload.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return 'GC-CAT-001: cantidad debe ser un número mayor a 0'
    }
    return null
  }
  const esquema = payload.esquema as { campos?: unknown } | undefined
  if (!esquema || !Array.isArray(esquema.campos)) {
    return 'GC-CAT-001: el formulario requiere esquema.campos'
  }
  return null
}

export function mensajeError(e: unknown, fallback = 'No se pudo completar la operación'): string {
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return fallback
}

export function subactividadesDeTexto(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export const DEMO_DEPARTAMENTOS: Departamento[] = [
  { id: 1, nombre: 'Guatemala' },
  { id: 2, nombre: 'Sacatepéquez' },
  { id: 3, nombre: 'Escuintla' },
]

export const DEMO_MUNICIPIOS: Municipio[] = [
  { id: 1, departamento_id: 1, nombre: 'Guatemala' },
  { id: 2, departamento_id: 1, nombre: 'Villa Nueva' },
  { id: 3, departamento_id: 1, nombre: 'Mixco' },
  { id: 4, departamento_id: 2, nombre: 'Antigua Guatemala' },
  { id: 5, departamento_id: 3, nombre: 'Escuintla' },
]

export const DEMO_MODULOS: ModuloCatalogo[] = [
  { id: 1, codigo: 'core', nombre: 'Núcleo operativo', nucleo: true },
  { id: 2, codigo: 'crm', nombre: 'CRM y leads', nucleo: false },
  { id: 3, codigo: 'creditos', nombre: 'Créditos y cartera', nucleo: false },
  { id: 4, codigo: 'solicitudes', nombre: 'Solicitudes y firma', nucleo: false },
  { id: 5, codigo: 'depositos', nombre: 'Depósitos', nucleo: false },
  { id: 6, codigo: 'kilometraje', nombre: 'Kilometraje', nucleo: false },
]

export const DEMO_PLANTILLAS: PlantillaBase[] = [
  {
    id: 1,
    rubro: 'agro',
    tipo: 'actividad',
    nombre: 'Verificación de garantías',
    payload: { sub_actividades: ['Inspección prendaria', 'Verificación de activos'] },
    activo: true,
  },
  {
    id: 2,
    rubro: 'agro',
    tipo: 'formulario',
    nombre: 'Ficha de cultivo',
    payload: {
      descripcion: 'Levantamiento en campo',
      esquema: { campos: [{ clave: 'cultivo', etiqueta: 'Cultivo', tipo: 'texto', requerido: true }] },
      calculo: 'porcentaje_completado',
    },
    activo: true,
  },
  {
    id: 3,
    rubro: 'agro',
    tipo: 'hora',
    nombre: '1 hora',
    payload: { cantidad: 1 },
    activo: true,
  },
  {
    id: 4,
    rubro: 'distribuidora',
    tipo: 'actividad',
    nombre: 'Toma de pedido',
    payload: { sub_actividades: ['Pedido programado', 'Pedido de temporada'] },
    activo: true,
  },
  {
    id: 5,
    rubro: 'farmaceutica',
    tipo: 'actividad',
    nombre: 'Visita médica',
    payload: { sub_actividades: ['Presentación de producto'] },
    activo: true,
  },
  {
    id: 6,
    rubro: 'generico',
    tipo: 'actividad',
    nombre: 'Visita comercial',
    payload: { sub_actividades: ['Seguimiento'] },
    activo: true,
  },
]
