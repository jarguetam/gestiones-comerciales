export type TipoCampo = 'texto' | 'numero' | 'seleccion' | 'booleano' | 'fecha'

export interface CampoEsquema {
  clave: string
  etiqueta: string
  tipo: TipoCampo
  requerido?: boolean
  opciones?: string[]
  min?: number
  max?: number
}

export type EsquemaFormulario = { campos?: unknown } | null | undefined

export type ValidacionOk = { ok: true }
export type ValidacionError = { ok: false; codigo: string; mensaje: string }
export type ValidacionResultado = ValidacionOk | ValidacionError

const TIPOS: TipoCampo[] = ['texto', 'numero', 'seleccion', 'booleano', 'fecha']

function esRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tipoDe(raw: unknown): TipoCampo {
  if (raw === 'lista') return 'seleccion'
  if (typeof raw === 'string' && (TIPOS as string[]).includes(raw)) return raw as TipoCampo
  return 'texto'
}

function opcionesDe(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const ops = raw.filter((o): o is string => typeof o === 'string')
  return ops.length ? ops : undefined
}

function numeroOpcional(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw)
  return undefined
}

export function camposDe(esquema: EsquemaFormulario | unknown): CampoEsquema[] {
  const root = esRecord(esquema) ? esquema : {}
  const lista = Array.isArray(root.campos) ? root.campos : []
  const out: CampoEsquema[] = []
  for (const item of lista) {
    if (!esRecord(item) || typeof item.clave !== 'string' || !item.clave) continue
    const campo: CampoEsquema = {
      clave: item.clave,
      etiqueta: typeof item.etiqueta === 'string' ? item.etiqueta : item.clave,
      tipo: tipoDe(item.tipo),
      requerido: Boolean(item.requerido),
    }
    const opciones = opcionesDe(item.opciones)
    if (opciones) campo.opciones = opciones
    const min = numeroOpcional(item.min)
    const max = numeroOpcional(item.max)
    if (min !== undefined) campo.min = min
    if (max !== undefined) campo.max = max
    out.push(campo)
  }
  return out
}

function valorPresente(respuestas: Record<string, unknown>, clave: string): boolean {
  return Object.prototype.hasOwnProperty.call(respuestas, clave)
}

function vacio(tipo: TipoCampo, valor: unknown): boolean {
  if (valor === undefined || valor === null) return true
  if (tipo === 'booleano') return typeof valor !== 'boolean'
  if (tipo === 'numero') return typeof valor !== 'number' || !Number.isFinite(valor)
  if (typeof valor === 'string') return valor.trim() === ''
  return false
}

function error(mensaje: string): ValidacionError {
  return { ok: false, codigo: 'GC-FORM-001', mensaje: `${mensaje} (GC-FORM-001)` }
}

export function validarRespuestas(
  esquema: EsquemaFormulario | unknown,
  respuestas: Record<string, unknown> | null | undefined,
): ValidacionResultado {
  const payload = respuestas ?? {}
  for (const campo of camposDe(esquema)) {
    const valor = payload[campo.clave]
    if (campo.requerido && vacio(campo.tipo, valor)) {
      return error(`Falta el campo requerido: ${campo.clave}`)
    }
    if (vacio(campo.tipo, valor) && !valorPresente(payload, campo.clave)) continue
    if (vacio(campo.tipo, valor) && !campo.requerido) continue

    if (campo.tipo === 'numero') {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        return error(`El campo ${campo.clave} debe ser numérico`)
      }
      if (campo.min !== undefined && valor < campo.min) {
        return error(`El campo ${campo.clave} está bajo el mínimo`)
      }
      if (campo.max !== undefined && valor > campo.max) {
        return error(`El campo ${campo.clave} excede el máximo`)
      }
    }

    if (campo.tipo === 'seleccion' && campo.opciones?.length) {
      const texto = typeof valor === 'string' ? valor : String(valor)
      if (!campo.opciones.includes(texto)) {
        return error(`Valor fuera de las opciones de ${campo.clave}`)
      }
    }
  }
  return { ok: true }
}

export function scorePorcentajeCompletado(
  esquema: EsquemaFormulario | unknown,
  respuestas: Record<string, unknown> | null | undefined,
): number {
  const campos = camposDe(esquema)
  if (campos.length === 0) return 0
  const payload = respuestas ?? {}
  const presentes = campos.filter((c) => valorPresente(payload, c.clave)).length
  return Math.round((100 * presentes) / campos.length)
}
