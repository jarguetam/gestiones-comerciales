/** Tipos y helpers del wizard de alta de empresa (P-02). */

export interface Rubro {
  codigo: string
  nombre: string
  descripcion: string
}

/** Rubros iniciales de la plataforma (los mismos del seed de módulos). */
export const RUBROS: Rubro[] = [
  { codigo: 'agro', nombre: 'Microfinanzas', descripcion: 'Créditos, depósitos y cobros' },
  { codigo: 'distribuidora', nombre: 'Distribución', descripcion: 'Ventas por ruta y punto de venta' },
  { codigo: 'farmaceutica', nombre: 'Farmacéutica', descripcion: 'Visitas médicas y detailing' },
  { codigo: 'generico', nombre: 'Genérico', descripcion: 'Fuerza comercial generalista' },
]

const RUBRO_ALIAS: Record<string, string> = { agromoney: 'agro', consumo: 'distribuidora', farmacia: 'farmaceutica' }

export function nombreRubro(codigo: string): string {
  const canon = RUBRO_ALIAS[codigo] ?? codigo
  return RUBROS.find((r) => r.codigo === canon)?.nombre ?? codigo
}

export const PLANES = ['basico', 'pro', 'enterprise'] as const
export type Plan = (typeof PLANES)[number]

export interface ModuloInfo {
  codigo: string
  nombre: string
  nucleo: boolean
}

/** Módulos optativos conocidos (núcleo siempre va activo). */
export const MODULOS: ModuloInfo[] = [
  { codigo: 'crm', nombre: 'CRM Leads', nucleo: false },
  { codigo: 'creditos', nombre: 'Créditos', nucleo: false },
  { codigo: 'solicitudes', nombre: 'Solicitudes', nucleo: false },
  { codigo: 'depositos', nombre: 'Depósitos', nucleo: false },
  { codigo: 'kilometraje', nombre: 'Kilometraje', nucleo: false },
]

export interface WizardState {
  paso: 1 | 2 | 3 | 4
  nombre: string
  rubro: string
  plan: Plan
  colorPrimario: string
  dominios: string
  modulos: string[]
  adminEmail: string
  adminNombre: string
  adminPassword: string
}

export const wizardInicial: WizardState = {
  paso: 1,
  nombre: '',
  rubro: '',
  plan: 'basico',
  colorPrimario: '#0f766e',
  dominios: '',
  modulos: [],
  adminEmail: '',
  adminNombre: '',
  adminPassword: '',
}

export function validarPaso1(w: WizardState): string | null {
  if (!w.nombre.trim()) return 'Ingresá el nombre de la empresa.'
  return null
}

export function validarPaso2(w: WizardState): string | null {
  if (!w.rubro) return 'Seleccioná un rubro.'
  const dominios = w.dominios
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  for (const d of dominios) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return `Dominio inválido: ${d}`
  }
  return null
}

export function validarPaso3(w: WizardState): string | null {
  if (w.modulos.length === 0) return 'La plataforma incluye el núcleo; podés no elegir módulos extra.'
  return null
}

export function validarPaso4(w: WizardState): string | null {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.adminEmail)) return 'Email del administrador inválido.'
  if (w.adminPassword.length < 8) return 'La contraseña del administrador debe tener al menos 8 caracteres.'
  return null
}

/** Payload branding para admin_tenant_crear. */
export function branding(w: WizardState) {
  return {
    color_primario: w.colorPrimario,
  }
}

/** Dominios CORS normalizados (vacío → null). */
export function dominiosArray(w: WizardState): string[] | null {
  const d = w.dominios
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  return d.length > 0 ? d : null
}
