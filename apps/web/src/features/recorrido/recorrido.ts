/**
 * Recorrido guiado del shell de empresa (Driver.js). Solo lógica pura: el hook
 * `useRecorrido` resuelve el DOM y carga la librería.
 */

export const VERSION_RECORRIDO = 'v1'

export type LadoPopover = 'top' | 'right' | 'bottom' | 'left'

export interface Ancla {
  selector: string
  lado?: LadoPopover
  /** El mismo módulo puede llamarse distinto en la barra de campo (p. ej. «Jornada»). */
  titulo?: string
}

export interface PasoRecorrido {
  id: string
  /** En orden de preferencia: escritorio, luego móvil. Vacío = popover centrado. */
  anclas: Ancla[]
  titulo: string
  descripcion: string
}

export interface ContextoRecorrido {
  empresa: string
  rol: string | undefined
  etiquetaVisitas: string
  etiquetaPersonas: string
  etiquetaJornada: string
  etiquetaCartera: string
}

export interface PasoResuelto<E> {
  id: string
  titulo: string
  descripcion: string
  lado?: LadoPopover
  elemento?: E
}

type Almacen = Pick<Storage, 'getItem' | 'setItem'>

const selector = (id: string) => `[data-tour="${id}"]`
/** Menú lateral: a la derecha, para no tapar los ítems de abajo. */
const lateral = (id: string): Ancla => ({ selector: selector(`nav-${id}`), lado: 'right' })
/** Barra inferior de campo: el popover sube. */
const campo = (id: string, titulo?: string): Ancla => ({ selector: selector(`campo-${id}`), lado: 'top', titulo })
const fija = (id: string, lado?: LadoPopover): Ancla => ({ selector: selector(id), lado })

/** Driver.js pinta título y descripción con innerHTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function catalogoRecorrido(ctx: ContextoRecorrido): PasoRecorrido[] {
  const empresa = ctx.empresa.trim() || 'tu empresa'
  const filtraEquipos = ctx.rol === 'gerente' || ctx.rol === 'admin'
  return [
    {
      id: 'bienvenida',
      anclas: [],
      titulo: 'Te damos la bienvenida a Gestiones Comerciales',
      descripcion: `Este recorrido de un minuto te muestra dónde está cada cosa en ${empresa}. Avanzá con «Siguiente» o con las flechas del teclado.`,
    },
    {
      id: 'menu',
      anclas: [fija('menu', 'right'), fija('menu-campo', 'top')],
      titulo: 'Menú',
      descripcion: 'Desde aquí llegás a cada módulo. Solo aparecen los que tu empresa tiene activos y tu rol puede ver.',
    },
    {
      id: 'tablero',
      anclas: [lateral('inicio'), campo('inicio', 'Hoy')],
      titulo: 'Tablero',
      descripcion: `Los indicadores del día: visitas programadas, porcentaje completado y asesores activos.${
        filtraEquipos ? ' Podés filtrarlos por el equipo de cada supervisor.' : ''
      }`,
    },
    {
      id: 'visitas',
      anclas: [lateral('visitas'), campo('visitas', ctx.etiquetaJornada)],
      titulo: ctx.etiquetaVisitas,
      descripcion:
        'La jornada de cada asesor: visitas programadas, completadas, aprobadas o rechazadas. Filtrá por estado, asesor y fecha.',
    },
    {
      id: 'personas',
      anclas: [lateral('personas'), campo('personas', ctx.etiquetaCartera)],
      titulo: ctx.etiquetaPersonas,
      descripcion: 'La cartera de clientes. Se puede cargar de una vez con la plantilla CSV.',
    },
    {
      id: 'crm',
      anclas: [lateral('crm'), campo('crm')],
      titulo: 'CRM',
      descripcion: 'Los prospectos por etapa, del primer contacto hasta ganado o perdido.',
    },
    {
      id: 'formularios',
      anclas: [lateral('formularios')],
      titulo: 'Formularios',
      descripcion: 'Los formularios que se llenan durante una visita, armados desde plantillas.',
    },
    {
      id: 'mapa',
      anclas: [lateral('mapa')],
      titulo: 'Mapa',
      descripcion: 'La última posición de cada asesor y su recorrido del día.',
    },
    {
      id: 'usuarios',
      anclas: [lateral('usuarios')],
      titulo: 'Usuarios',
      descripcion: 'La estructura comercial: gerente, supervisores y asesores, y quién reporta a quién.',
    },
    {
      id: 'configuracion',
      anclas: [lateral('configuracion')],
      titulo: 'Configuración',
      descripcion: 'Marca, catálogos de actividades, rastreo y plantillas de la empresa.',
    },
    {
      id: 'mas',
      anclas: [campo('mas')],
      titulo: 'Más',
      descripcion: 'Formularios, notificaciones, los demás módulos de tu rol y el botón Salir.',
    },
    {
      id: 'campana',
      anclas: [fija('campana')],
      titulo: 'Notificaciones',
      descripcion: 'Tus avisos. El número indica cuántos no has leído.',
    },
    {
      id: 'nueva-visita',
      anclas: [fija('nueva-visita'), fija('nueva-visita-fab', 'top')],
      titulo: 'Nueva visita',
      descripcion: 'Agendá una visita a un cliente desde cualquier pantalla.',
    },
    {
      id: 'repetir',
      anclas: [fija('recorrido')],
      titulo: 'Repetir el recorrido',
      descripcion: 'Volvé a verlo cuando quieras desde este botón. Al terminar, cerrá tu sesión con «Salir».',
    },
  ]
}

/**
 * Deja solo los pasos con un ancla visible. Así el recorrido se adapta solo al rol,
 * a los módulos activos y al ancho de pantalla, sin duplicar esas reglas aquí.
 */
export function resolverPasos<E>(
  pasos: PasoRecorrido[],
  buscarVisible: (selector: string) => E | null,
): PasoResuelto<E>[] {
  const resueltos: PasoResuelto<E>[] = []
  for (const paso of pasos) {
    const base = { id: paso.id, titulo: paso.titulo, descripcion: paso.descripcion }
    if (paso.anclas.length === 0) {
      resueltos.push(base)
      continue
    }
    for (const ancla of paso.anclas) {
      const elemento = buscarVisible(ancla.selector)
      if (elemento) {
        resueltos.push({ ...base, titulo: ancla.titulo ?? paso.titulo, lado: ancla.lado, elemento })
        break
      }
    }
  }
  return resueltos
}

export function claveRecorrido(usuarioId: string): string {
  return `gc.recorrido.${VERSION_RECORRIDO}:${usuarioId}`
}

export interface CondicionesAutoinicio {
  almacen: Almacen | null
  usuarioId: string | undefined
  ruta: string
  /** navigator.webdriver: los e2e no deben toparse con el overlay. */
  automatizado: boolean
}

export function debeAutoiniciar(c: CondicionesAutoinicio): boolean {
  if (!c.usuarioId || c.automatizado || c.ruta !== '/' || !c.almacen) return false
  let marca: string | null
  try {
    marca = c.almacen.getItem(claveRecorrido(c.usuarioId))
  } catch (e) {
    // Sin storage no se puede recordar que ya lo vio: mejor no insistir en cada visita.
    console.warn('GC-RECORRIDO: storage no disponible', e)
    return false
  }
  return marca !== '1'
}

export function marcarRecorridoVisto(almacen: Almacen | null, usuarioId: string | undefined): boolean {
  if (!almacen || !usuarioId) return false
  try {
    almacen.setItem(claveRecorrido(usuarioId), '1')
    return true
  } catch (e) {
    console.warn('GC-RECORRIDO: no se pudo guardar la marca de visto', e)
    return false
  }
}
