/**
 * Lectura por páginas con `.range()`. PostgREST recorta cada respuesta a `max_rows`
 * (500 en `supabase/config.toml`) sin avisar, así que un `.limit()` mayor se trunca en
 * silencio. Se piden páginas de 500 hasta una página corta o hasta el límite.
 * La consulta debe tener un orden total (terminar en `id`) para que no se salten filas.
 */

export const TAM_PAGINA = 500

export async function leerPaginado<T>(
  pedir: (desde: number, hasta: number) => Promise<T[]>,
  opts: { limite?: number } = {},
): Promise<T[]> {
  const limite = opts.limite ?? Number.POSITIVE_INFINITY
  const filas: T[] = []
  while (filas.length < limite) {
    const desde = filas.length
    const cantidad = Math.min(TAM_PAGINA, limite - desde)
    const pagina = await pedir(desde, desde + cantidad - 1)
    filas.push(...pagina.slice(0, cantidad))
    if (pagina.length < cantidad) break
  }
  return filas
}
