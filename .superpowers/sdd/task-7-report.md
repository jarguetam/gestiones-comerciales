# Task 7 — quitar UPDATE PostgREST de máquinas de estado

Fecha: 2026-08-30
Rama compartida: `cursor/gate-1-security-9de6`
PR existente: <https://github.com/jarguetam/gestiones-comerciales/pull/40>

## Estado

Implementado y publicado. El cambio cubre las máquinas reales `deposito`,
`solicitud`, `lead` y `visita`; no crea `api.ts` ni duplica APIs.

Archivos de Task 7:

- `apps/web/tests/api-mutations.test.ts`
- `supabase/migrations/20260830003000_revoke_direct_updates.sql`
- `supabase/tests/p1_state_machines.sql`
- `supabase/tests/p1_state_machines_static.test.mjs`
- este informe

## Inventario de clientes

Se inspeccionaron por AST todos los módulos TypeScript/TSX bajo
`apps/web/src`, `apps/backoffice/src` y `apps/mobile/src`.

Resultado:

- Web confirma depósitos mediante `deposito_confirmar`.
- Web mueve leads mediante `lead_transicion`.
- Mobile mueve leads mediante `lead_transicion`.
- Mobile hace check-in/completa visitas mediante `visita_checkin` y
  `visita_completar`.
- Solicitudes mobile crea el registro inicial en `borrador`; la UI actual no
  ofrece una mutación de transición. No existe `UPDATE` directo.
- Backoffice no muta ninguna de estas cuatro tablas.
- No existe `UPDATE` directo a `deposito`, `solicitud`, `lead` o `visita` en
  ninguno de los tres clientes.

Los `UPDATE` cliente restantes son de notificaciones, branding/configuración
del tenant, catálogos de actividad y configuración de rastreo; no escriben una
columna de las máquinas cubiertas.

También se revisaron los demás campos de estado del schema:

- `persona.verificacion_estado` no tiene transición RPC ni mutación cliente.
- `cuenta.estado` se sincroniza desde la RPC SECURITY DEFINER del importador;
  el cliente es de lectura.
- `integracion_evento.estado` es interno a `integracion_recibir` y no tiene
  `UPDATE` para `authenticated`.

Por eso no se añadieron `persona`, `cuenta` ni `integracion_evento` al ACL de
Task 7.

## Frontera SQL

La migración revoca el privilegio `UPDATE` de tabla para `PUBLIC`, `anon` y
`authenticated`, y concede a `authenticated` únicamente estas columnas:

| Tabla | Columnas con `UPDATE` directo |
| --- | --- |
| `deposito` | `monto`, `referencia` |
| `solicitud` | `monto`, `descripcion` |
| `lead` | origen, identidad/contacto, geografía, monto y `detalles` |
| `visita` | persona, descripción y campos de agenda |

Quedan fuera de esos grants:

- estados: `deposito.estado`, `solicitud.estado_id`, `lead.estado_id`,
  `visita.estado`;
- confirmación de depósito;
- pérdida, conversión y reasignación de lead;
- GPS, completado y revisión de visita.

Como no queda `UPDATE` de tabla, una columna futura nace sin permiso de
escritura para `authenticated`: el comportamiento es deny-by-default.

No se usa GUC, trigger activable por caller ni bypass equivalente. Las RPC
SECURITY DEFINER ejecutan con el owner y conservan la capacidad de cambiar sus
columnas protegidas. Las policies RLS existentes no se modifican y continúan
aplicando tenant, módulo y alcance a las ediciones directas permitidas.

## Continuidad de visita

La tabla `visita` tenía desde su migración original el trigger
`trg_visita_actualizado`, que llama `set_actualizado_en()`, pero no tenía la
columna `actualizado_en`. Cualquier `UPDATE`, incluidas las RPC canónicas,
fallaría al ejecutar el trigger.

Task 7 agrega `visita.actualizado_en timestamptz not null default now()` antes
de aplicar los ACL. Es la corrección mínima para que `visita_completar` y las
demás RPC de visita puedan seguir actualizando la fila.

## pgTAP

`p1_state_machines.sql` es autónomo: abre una transacción, crea Auth, tenant,
jerarquía, módulos, catálogos y registros propios, y termina con `rollback`.
Declara 27 aserciones que cubren:

1. ausencia de `UPDATE` amplio y de privilegios sobre columnas protegidas;
2. grants explícitos sobre columnas editables;
3. RLS y policies `UPDATE` aún presentes;
4. RPC canónicas aún `SECURITY DEFINER`;
5. `UPDATE` directo de cada estado rechazado con `42501`;
6. una actualización no-estado permitida por cada tabla;
7. transición efectiva mediante `deposito_confirmar`,
   `solicitud_transicion`, `lead_transicion` y `visita_completar`.

Por instrucción de la task no se intentó ejecutar pgTAP sin runtime
PostgreSQL/Supabase. Se validaron gramática, plan y contratos estáticos.

## TDD y commits publicados

Tests publicados antes de RED:

```text
bd78f64 test: define state machine mutation contracts
a6be669 test: allow pgTAP contract header
```

El segundo commit corrige una precondición del validador estático descubierta
en el primer intento: el archivo pgTAP empieza con comentarios antes de
`begin`.

RED válido observado después de publicar ambos commits:

```text
node --test supabase/tests/p1_state_machines_static.test.mjs
1 pass, 1 fail
```

La única causa fue la esperada: no existía todavía una migración
`*_revoke_direct_updates.sql`.

Implementación publicada antes de GREEN:

```text
005f6ec fix: block direct state machine updates
```

## Verificaciones

```text
node --test supabase/tests/p1_state_machines_static.test.mjs
2 pass, 0 fail

pnpm --filter @gc/web exec node --experimental-strip-types \
  --test tests/api-mutations.test.ts
3 pass, 0 fail

pnpm --filter @gc/web test
85 pass, 0 fail

pnpm --filter @gc/web typecheck
exit 0

pglast:
  migración Task 7: 10 statements
  p1_state_machines.sql: 57 statements

git diff --check origin/main...HEAD
exit 0

lockfiles en el diff
0
```

El runner Node emite sus warnings habituales de
`--experimental-strip-types`. El test que importa el módulo mobile también
advierte que `apps/mobile/package.json` no declara `type: module`; no se cambió
ese package porque no afecta el resultado y está fuera del alcance de Task 7.

## Concern pendiente

La ejecución dinámica de las 27 aserciones pgTAP debe ocurrir en CI o en un
entorno con PostgreSQL/Supabase disponible. En esta VM se validó el parseo con
`pglast` y el plan 27/27 mediante el test estático, conforme a la instrucción
de no intentar runtime para pgTAP.
