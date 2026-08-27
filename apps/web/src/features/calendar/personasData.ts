/**
 * Datos de demostración alineados al dominio real de la plataforma:
 * cartera de personas del asesor (tabla persona, F1.1) reutilizada por
 * PersonasView y por el dropdown de cliente del modal de nueva visita.
 * Sin datos del template original.
 */

export interface PersonaItem {
  id: string
  nombre: string
  categoria: string
  documento: string
  telefono: string
  direccion: string
  visitasPendientes: number
  saldo?: string
}

export const INITIAL_PERSONAS: PersonaItem[] = [
  {
    id: 'p1',
    nombre: 'Agropecuaria El Triunfo',
    categoria: 'Cliente — Crédito agrícola activo',
    documento: 'NIT 8492019-3',
    telefono: '+502 5521-9988',
    direccion: 'Km 56 Carretera a Puerto San José, Escuintla',
    visitasPendientes: 2,
    saldo: 'Q 45,000.00',
  },
  {
    id: 'p2',
    nombre: 'Distribuidora La Bendición',
    categoria: 'Cliente — Crédito de consumo activo',
    documento: 'NIT 2948102-1',
    telefono: '+502 5584-3311',
    direccion: '6a Avenida 12-45 Zona 1, Quetzaltenango',
    visitasPendientes: 1,
    saldo: 'Q 18,250.00',
  },
  {
    id: 'p3',
    nombre: 'Farmacia Santa María',
    categoria: 'Cliente — Crédito de consumo activo',
    documento: 'NIT 9948201-8',
    telefono: '+502 7765-2210',
    direccion: 'Avenida Elena 7-31 Zona 10, Guatemala',
    visitasPendientes: 0,
    saldo: 'Q 8,100.00',
  },
  {
    id: 'p4',
    nombre: 'Cooperativa Agrícola San Pedro',
    categoria: 'Cliente — Crédito agrícola activo',
    documento: 'DPI 2489 19201 0101',
    telefono: '+502 5299-7744',
    direccion: 'Camino Real Sector 3, Totonicapán',
    visitasPendientes: 1,
    saldo: 'Q 62,400.00',
  },
  {
    id: 'p5',
    nombre: 'Finca Santa Isabel',
    categoria: 'Cliente — Crédito agrícola activo',
    documento: 'NIT 7710234-5',
    telefono: '+502 5530-4482',
    direccion: 'Aldea Chichén, Km 86 Ruta al Atlántico, Alta Verapaz',
    visitasPendientes: 2,
    saldo: 'Q 120,000.00',
  },
  {
    id: 'p6',
    nombre: 'Transportes El Norte',
    categoria: 'Cliente — Crédito activo',
    documento: 'NIT 5560012-9',
    telefono: '+502 5501-8890',
    direccion: 'Ruta al Norte Km 189, Cobán',
    visitasPendientes: 1,
    saldo: 'Q 310,500.00',
  },
  {
    id: 'p7',
    nombre: 'Comercial El Progreso',
    categoria: 'Cliente — En mora (45 días)',
    documento: 'NIT 3302456-7',
    telefono: '+502 5567-1193',
    direccion: '4a Calle 15-22 Zona 2, Mixco',
    visitasPendientes: 3,
    saldo: 'Q 8,900.00',
  },
]

/** Busca una persona del catálogo por nombre exacto (para preseleccionar desde PersonasView). */
export function findPersonaByNombre(nombre: string): PersonaItem | undefined {
  return INITIAL_PERSONAS.find((p) => p.nombre === nombre)
}

/** Genera el siguiente id de cartera (alta inline desde el modal de visita). */
export function nextPersonaId(): string {
  return `p${INITIAL_PERSONAS.length + 1}`
}
