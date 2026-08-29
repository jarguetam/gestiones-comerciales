export function assertToolchain(v: { node: string; pnpm: string }) {
  if (!v.node.startsWith('22.14.')) throw new Error('GC-OPS-010: Node debe ser 22.14.x')
  if (v.pnpm !== '9.15.9') throw new Error('GC-OPS-010: pnpm debe ser 9.15.9')
}
