import { readFileSync } from 'node:fs'

export function evaluateRestoreFixture(sql: string): { ok: boolean; detail: string } {
  if (!/select\s+1/i.test(sql)) {
    return { ok: false, detail: 'GC-OPS-009: el fixture de dry-run debe contener SELECT 1' }
  }
  return { ok: true, detail: 'dry-run: select 1' }
}

export function restoreTargetAllowed(projectRef: string | undefined): boolean {
  if (!projectRef) return false
  return projectRef !== 'xcoeipsnykceorcvjwve'
}

export function readRestoreFixture(path: string): string {
  return readFileSync(path, 'utf8')
}
