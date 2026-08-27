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
    categoria: 'Cliente — Crédito de capital de trabajo',
    documento: 'NIT 2948102-1',
    telefono: '+502 4432-1100',
    direccion: '4a Calle 12-45 Zona 3, Quetzaltenango',
    visitasPendientes: 1,
    saldo: 'Q 18,250.00',
  },
  {
    id: 'p3',
    nombre: 'Farmacia Santa María',
    categoria: 'Cliente — Ampliación de local (verificar uso de fondos)',
    documento: 'NIT 9948201-8',
    telefono: '+502 3320-7711',
    direccion: 'Avenida Elena 8-30 Zona 1, Guatemala',
    visitasPendientes: 1,
  },
  {
    id: 'p4',
    nombre: 'Cooperativa Agrícola San Pedro',
    categoria: 'Prospecto — Levantamiento de ficha pendiente',
    documento: 'DPI 2489 19201 0101',
    telefono: '+502 5900-2233',
    direccion: 'San Pedro Carchá, Alta Verapaz',
    visitasPendientes: 1,
  },
  {
    id: 'p5',
    nombre: 'Finca Santa Isabel',
    categoria: 'Cliente — Cultivo de maíz (pre-cosecha)',
    documento: 'NIT 7710234-5',
    telefono: '+502 5510-4477',
    direccion: 'Aldea Panzós, Valle del Polochic',
    visitasPendientes: 1,
    saldo: 'Q 120,000.00',
  },
  {
    id: 'p6',
    nombre: 'Transportes El Norte',
    categoria: 'Cliente — Prenda vehicular (Freightliner)',
    documento: 'NIT 5560012-9',
    telefono: '+502 5588-2211',
    direccion: 'Ruta al Atlántico Km 85, El Progreso',
    visitasPendientes: 1,
    saldo: 'Q 310,500.00',
  },
  {
    id: 'p7',
    nombre: 'Comercial El Progreso',
    categoria: 'Cliente en mora (45 días)',
    documento: 'NIT 3302456-7',
    telefono: '+502 4400-9987',
    direccion: '7a Avenida 6-20 Zona 1, Cobán',
    visitasPendientes: 1,
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
