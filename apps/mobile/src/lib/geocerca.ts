/** Check-in geocerca: registra fuera de rango, no bloquea (spec §3.2). */

const R_TIERRA_M = 6_371_000

function aRad(g: number): number {
  return (g * Math.PI) / 180
}

export function distanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = aRad(lat2 - lat1)
  const dLon = aRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function fueraDeRango(distanciaM: number, umbralM: number): boolean {
  return distanciaM > umbralM
}
