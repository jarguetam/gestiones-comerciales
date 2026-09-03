/** Recolector de hallazgos del paseo QA. */

export type TipoHallazgo =
  | 'crash'
  | 'blank'
  | 'redirect'
  | 'console'
  | 'network'
  | 'data-spec'
  | 'axe'
  | 'control'

export type Severidad = 'critical' | 'high' | 'medium' | 'low'

export type Hallazgo = {
  tipo: TipoHallazgo
  severidad: Severidad
  ruta: string
  mensaje: string
  evidencia?: string
}

export type ReportePaseo = {
  baseUrl: string
  modo: 'public' | 'auth'
  hallazgos: Hallazgo[]
  generadoEn?: string
}

export class Recolector {
  #items: Hallazgo[] = []

  add(h: Hallazgo): void {
    this.#items.push(h)
  }

  todos(): Hallazgo[] {
    return [...this.#items]
  }

  porSeveridad(sev: Severidad): Hallazgo[] {
    return this.#items.filter((h) => h.severidad === sev)
  }

  merge(...otros: Recolector[]): void {
    for (const o of otros) this.#items.push(...o.todos())
  }
}

export function formatearReporteMd(r: ReportePaseo): string {
  const when = r.generadoEn ?? new Date().toISOString()
  const n = r.hallazgos.length
  const lines = [
    `# qa-paseo — reporte`,
    ``,
    `- Base URL: \`${r.baseUrl}\``,
    `- Modo: \`${r.modo}\``,
    `- Generado: ${when}`,
    `- Hallazgos: **${n}**`,
    ``,
  ]
  if (n === 0) {
    lines.push(`Sin hallazgos.`)
    return lines.join('\n')
  }
  lines.push(`| Severidad | Tipo | Ruta | Mensaje | Evidencia |`)
  lines.push(`|-----------|------|------|---------|-----------|`)
  for (const h of r.hallazgos) {
    const ev = (h.evidencia ?? '').replace(/\|/g, '\\|')
    const msg = h.mensaje.replace(/\|/g, '\\|')
    lines.push(`| ${h.severidad} | ${h.tipo} | \`${h.ruta}\` | ${msg} | ${ev} |`)
  }
  lines.push(``)
  lines.push(`${n} hallazgo${n === 1 ? '' : 's'}.`)
  return lines.join('\n')
}

export function severidadAxe(impact: string | null | undefined): Severidad {
  if (impact === 'critical') return 'critical'
  if (impact === 'serious') return 'high'
  if (impact === 'moderate') return 'medium'
  return 'low'
}
