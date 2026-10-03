# Proposal — complete-home-movil

## Problema
`spec/frontend/SPEC.md` define M-02 como «Home / agenda del día — resumen de
gestión y accesos rápidos». La app móvil solo implementa la agenda: el asesor
abre la app y ve una lista de visitas. Para saber cuántos leads tiene abiertos,
si quedaron depósitos o borradores, o si hay mutaciones sin sincronizar, debe
recorrer cuatro pestañas.

La referencia visual que trajo el usuario (app de organización familiar) resuelve
eso con un tablero de tarjetas resumen. Se toma ese patrón, no su estética:
el design system de campo prohíbe pasteles de evento, rails de color, header
púrpura, clipart y FAB genérico (`docs/frontend/design-system.md`).

## Cambio propuesto
1. La pestaña **Agenda** pasa a llamarse **Hoy** y sigue siendo la primera.
   No se agrega una quinta pestaña (el bottom nav admite 4 + Más).
2. Arriba de la lista de visitas, una grilla de tarjetas resumen de 2 columnas.
   Cada tarjeta: ícono SVG mudo, título, número y una línea de contexto.
   Al tocarla, abre la pestaña correspondiente.
   - **Visitas**: `hechas / total` y barra de progreso con el primario del tenant
     (reusa `progresoJornada`).
   - **Leads** (módulo `crm`): leads abiertos (estado no ganado ni perdido).
   - **Solicitudes** (módulo `solicitudes`): borradores pendientes de enviar.
   - **Depósitos** (módulo `depositos`): depósitos registrados hoy.
   - **Sincronización**: pendientes y errores de la cola local. Funciona sin red.
3. Tarjetas de módulos inactivos no se renderizan (misma regla que el menú Más).
4. Sin conexión: Visitas y Sincronización muestran datos locales. Las demás
   muestran «—» y «Sin conexión»; nunca un 0 inventado.
5. Error de carga en una tarjeta: «—» y código `GC-*` en esa tarjeta; no bloquea
   la agenda ni las otras tarjetas.
6. Ajustes visuales dentro de los tokens actuales: radio de `Card`, espaciado
   y tamaño del número resumen. Sin colores nuevos.

## Impacto
Solo `apps/mobile`: `App.tsx` (etiqueta del tab), `AgendaScreen.tsx` (encabezado
de lista), un componente nuevo en `components/ui` y un helper puro para los
conteos con test `node:test`. Lecturas con `supabase.from` + RLS existentes.
Sin migraciones, RPC ni Edge. La web no cambia.

## Fuera de alcance
Paleta de colores por tipo de visita, ilustraciones, mapa de ubicación, vista de
agenda por asesor en columnas (candidata para web/supervisor en otro change),
caché offline de leads/solicitudes/depósitos, notificaciones en tarjetas.

## Preguntas de aclaración
| Pregunta | Default si no hay respuesta |
|---|---|
| ¿Renombrar «Agenda» a «Hoy» o mantener «Agenda»? | «Hoy», alineado con el design system (bottom nav: Hoy, Jornada, Cartera, CRM). |
| ¿Tarjetas arriba de la lista o pantalla separada? | Arriba de la lista, colapsando al hacer scroll. Un toque menos para el check-in. |
| ¿Qué cuenta «Leads»? | Abiertos visibles por RLS para el usuario (lo mismo que ya lista M-11). |
| ¿Qué cuenta «Depósitos»? | Registrados hoy por el usuario. `deposito.estado = 'pendiente'` existe, pero significa «sin confirmar por supervisión», no una acción del asesor. |
| ¿Mostrar tarjeta de Notificaciones? | No: la campana del header ya muestra no leídas. |
| ¿Incluir Formularios/Fichas? | No: no hay un conteo accionable sin definir «formulario pendiente». |
