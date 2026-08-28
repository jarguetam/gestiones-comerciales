import type { CampoEsquema } from '../../lib/formulario'

export interface PlantillaFormulario {
  id: string
  nombre: string
  descripcion: string
  esquema: { campos: CampoEsquema[] }
  calculo: string | null
}

export interface RespuestaFormulario {
  id: string
  plantillaId: string
  plantillaNombre: string
  respuestas: Record<string, unknown>
  resultado: number | null
  enviadoEn: string
}

export const PLANTILLAS_DEMO: PlantillaFormulario[] = [
  {
    id: 'ficha-cultivo',
    nombre: 'Ficha de cultivo',
    descripcion: 'Levantamiento en campo del estado del cultivo financiado',
    calculo: 'porcentaje_completado',
    esquema: {
      campos: [
        { clave: 'cultivo', etiqueta: 'Cultivo', tipo: 'texto', requerido: true },
        { clave: 'hectareas', etiqueta: 'Hectáreas sembradas', tipo: 'numero', requerido: true, min: 0.1, max: 10000 },
        {
          clave: 'estado_fenologico',
          etiqueta: 'Estado fenológico',
          tipo: 'seleccion',
          requerido: true,
          opciones: ['Germinación', 'Crecimiento', 'Floración', 'Llenado de grano', 'Madurez', 'Cosecha'],
        },
        { clave: 'plagas_observadas', etiqueta: 'Plagas observadas', tipo: 'texto', requerido: false },
        {
          clave: 'aplicaciones',
          etiqueta: 'Aplicaciones aplicadas',
          tipo: 'seleccion',
          requerido: false,
          opciones: ['Ninguna', 'Fungicida', 'Insecticida', 'Fertilizante', 'Mixta'],
        },
        { clave: 'rendimiento_estimado', etiqueta: 'Rendimiento estimado (qq)', tipo: 'numero', requerido: false, min: 0, max: 1000 },
        { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', requerido: false },
      ],
    },
  },
  {
    id: 'verificacion-garantias',
    nombre: 'Verificación de garantías',
    descripcion: 'Inspección prendaria de activos del crédito',
    calculo: 'porcentaje_completado',
    esquema: {
      campos: [
        {
          clave: 'tipo_garantia',
          etiqueta: 'Tipo de garantía',
          tipo: 'seleccion',
          requerido: true,
          opciones: ['Maquinaria agrícola', 'Vehículo', 'Inventario', 'Inmueble', 'Prenda ganadera'],
        },
        {
          clave: 'estado_conservacion',
          etiqueta: 'Estado de conservación',
          tipo: 'seleccion',
          requerido: true,
          opciones: ['Excelente', 'Bueno', 'Regular', 'Deteriorado'],
        },
        { clave: 'valor_estimado', etiqueta: 'Valor estimado (Q)', tipo: 'numero', requerido: true, min: 0, max: 10000000 },
        { clave: 'serie_motor', etiqueta: 'Serie/motor', tipo: 'texto', requerido: false },
        { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', requerido: false },
      ],
    },
  },
]

export const RESPUESTAS_DEMO: RespuestaFormulario[] = [
  {
    id: 'r1',
    plantillaId: 'ficha-cultivo',
    plantillaNombre: 'Ficha de cultivo',
    resultado: 71,
    enviadoEn: '2026-08-20T14:30:00.000Z',
    respuestas: {
      cultivo: 'Maíz',
      hectareas: 4.5,
      estado_fenologico: 'Floración',
      plagas_observadas: 'Ninguna visible',
      aplicaciones: 'Fertilizante',
    },
  },
  {
    id: 'r2',
    plantillaId: 'verificacion-garantias',
    plantillaNombre: 'Verificación de garantías',
    resultado: 80,
    enviadoEn: '2026-08-18T09:10:00.000Z',
    respuestas: {
      tipo_garantia: 'Maquinaria agrícola',
      estado_conservacion: 'Bueno',
      valor_estimado: 85000,
      serie_motor: 'JD-4420-8821',
    },
  },
]
