# Tasks — complete-home-movil

- [x] Helper puro `apps/mobile/src/lib/resumenHoy.ts`: tarjetas visibles por módulo, valor de conteo (ok / sin conexión / error `GC-*`), inicio del día local. Done: `apps/mobile/tests/resumenHoy.test.ts`.
- [x] `TarjetaResumen` en `apps/mobile/src/components/ui`: ícono, título, valor, contexto, barra opcional; `accessibilityLabel` y target ≥ 44 px. Sin rail ni color nuevo.
- [x] `ResumenHoy` sobre la lista de `AgendaScreen`; cada lectura falla por separado.
- [x] Tab «Agenda» → «Hoy»; tocar una tarjeta abre su pestaña.
- [x] `pnpm --filter @gc/mobile test`, `typecheck` y `lint` verdes.
- [ ] Validación manual en dispositivo (con y sin red). Pendiente: requiere build.
