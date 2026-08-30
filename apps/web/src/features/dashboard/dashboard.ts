/** W-02 / W-02b — KPIs y drill-down del tablero de empresa. */

export interface FilaDashboard {
  usuario_id: string
  nombre: string
  rol: string
  jefe_id?: string | null
  visitas_programadas: number
  visitas_completadas: number
  visitas_aprobadas: number
  visitas_rechazadas: number
  total_personas?: number
}

export interface KpisDashboard {
  programadas: number
  completadas: number
  aprobadas: number
  rechazadas: number
  visitas: number
  asesoresActivos: number
  pctCompletadas: number
}

export interface RankingEquipo {
  usuario_id: string
  nombre: string
  rol: string
  completadas: number
}

export function filasDelEquipo(filas: FilaDashboard[], supervisorId: string | null): FilaDashboard[] {
  if (!supervisorId) return filas
  return filas.filter((f) => f.usuario_id === supervisorId || f.jefe_id === supervisorId)
}

export function kpisDeFilas(filas: FilaDashboard[]): KpisDashboard {
  const programadas = filas.reduce((a, f) => a + Number(f.visitas_programadas ?? 0), 0)
  const completadas = filas.reduce((a, f) => a + Number(f.visitas_completadas ?? 0), 0)
  const aprobadas = filas.reduce((a, f) => a + Number(f.visitas_aprobadas ?? 0), 0)
  const rechazadas = filas.reduce((a, f) => a + Number(f.visitas_rechazadas ?? 0), 0)
  const visitas = programadas + completadas + aprobadas + rechazadas
  return {
    programadas,
    completadas,
    aprobadas,
    rechazadas,
    visitas,
    asesoresActivos: filas.filter((f) => f.rol === 'asesor').length,
    pctCompletadas: porcentajeCompletadas({ visitas, completadas, aprobadas }),
  }
}

export function porcentajeCompletadas(args: {
  visitas: number
  completadas: number
  aprobadas: number
}): number {
  if (args.visitas <= 0) return 0
  return Math.round(((args.completadas + args.aprobadas) / args.visitas) * 100)
}

export function rankingSupervisores(filas: FilaDashboard[]): RankingEquipo[] {
  return filas
    .filter((f) => f.rol === 'supervisor')
    .map((s) => {
      const k = kpisDeFilas(filasDelEquipo(filas, s.usuario_id))
      return { usuario_id: s.usuario_id, nombre: s.nombre, rol: s.rol, completadas: k.completadas }
    })
    .sort((a, b) => b.completadas - a.completadas)
}

export function demoFilasDashboard(): FilaDashboard[] {
  return [
    {
      usuario_id: 'g1',
      nombre: 'Ana Admin',
      rol: 'gerente',
      jefe_id: null,
      visitas_programadas: 0,
      visitas_completadas: 0,
      visitas_aprobadas: 0,
      visitas_rechazadas: 0,
    },
    {
      usuario_id: 's1',
      nombre: 'Erick Supervisor',
      rol: 'supervisor',
      jefe_id: 'g1',
      visitas_programadas: 1,
      visitas_completadas: 2,
      visitas_aprobadas: 1,
      visitas_rechazadas: 0,
    },
    {
      usuario_id: 'a1',
      nombre: 'Luisa Asesora',
      rol: 'asesor',
      jefe_id: 's1',
      visitas_programadas: 4,
      visitas_completadas: 3,
      visitas_aprobadas: 1,
      visitas_rechazadas: 0,
      total_personas: 12,
    },
    {
      usuario_id: 's2',
      nombre: 'Mario Supervisor',
      rol: 'supervisor',
      jefe_id: 'g1',
      visitas_programadas: 0,
      visitas_completadas: 1,
      visitas_aprobadas: 0,
      visitas_rechazadas: 0,
    },
    {
      usuario_id: 'a2',
      nombre: 'Ana Asesora',
      rol: 'asesor',
      jefe_id: 's2',
      visitas_programadas: 2,
      visitas_completadas: 1,
      visitas_aprobadas: 0,
      visitas_rechazadas: 1,
      total_personas: 7,
    },
  ]
}

export function puedeDrillDown(rol: string | undefined): boolean {
  return rol === 'admin' || rol === 'gerente'
}
