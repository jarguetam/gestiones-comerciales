# React Doctor — triage Gate 3

Hallazgos revisados a mano sobre `apps/web` y `apps/backoffice` (2026-08-30).
No se cambió código por falsos positivos de `persistir.ts` / `CatalogosPage`.

| Hallazgo | Veredicto | Notas |
|---|---|---|
| `dangerouslySetInnerHTML` | Ausente | No hay HTML crudo en clientes. |
| Secrets en cliente | OK | Solo anon key + DSN público. Comentarios prohíben `service_role`. |
| `key={i}` en `Skeleton` / `TableSkeleton` | Falso positivo | Placeholders de carga, no identidad de dominio. |
| `key={i}` en errores de import (`PersonasPage`) | Aceptable | Lista efímera de mensajes; no hay id estable. |
| `persistir.ts` / mutaciones | Falso positivo | Las reglas viven en RPC; el cliente solo mapea `GC-*`. |
| `CatalogosPage` keys | Falso positivo | Filas usan ids de catálogo cuando existen. |
| ErrorBoundary de clase | Intencional | API de React para `componentDidCatch`. |
| `HashRouter` | Intencional | GitHub Pages sin rewrite. |

Fixes reales aplicados en este gate: fail-closed env, sin demo, guards,
Sentry sin PII, CSP sin `unsafe-inline` en scripts.
