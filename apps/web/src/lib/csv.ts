/** Parser CSV mínimo (alineado con supabase/functions/_shared/csv.ts). */

export function parseCsv(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = splitCsv(cleaned)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  return rows
    .slice(1)
    .filter((cols) => cols.some((c) => c.trim() !== ''))
    .map((cols) => {
      const rec: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        if (headers[i]) rec[headers[i]] = (cols[i] ?? '').trim()
      }
      return rec
    })
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (quoted) throw new Error('GC-IMP-006: CSV con comillas sin cerrar')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export const PLANTILLA_PERSONAS_CSV =
  'nombre,documento,documento_tipo,direccion,categoria,telefono,codigo_externo\n' +
  'Ejemplo SA,NIT-0001,NIT,Ciudad de Guatemala,Cliente,+502 5555-0000,EXT-1\n'
