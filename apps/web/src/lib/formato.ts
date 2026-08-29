/** Moneda GTQ compartida por Solicitudes, Depósitos y Cuentas. */
export function quetzales(n: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n)
}
