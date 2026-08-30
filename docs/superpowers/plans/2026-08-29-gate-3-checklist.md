# Checklist Gate 3 — web runtime

- [x] `pnpm --filter @gc/web typecheck`
- [x] `pnpm --filter @gc/backoffice typecheck`
- [x] `pnpm --filter @gc/web test`
- [x] `pnpm --filter @gc/backoffice test`
- [ ] `pnpm --filter @gc/web test:e2e` (CI validate; login + axe públicos)
- [ ] `pnpm --filter @gc/backoffice test:e2e` (CI validate)
- [x] Build fail-closed sin URL/anon/DSN/release (`GC-CORE-001`)
- [x] Login real; sin «Entrar al tablero» / AgroMoney
- [x] Guards W-10 / W-11 + MFA backoffice
- [x] ErrorBoundary + Sentry + `x-request-id`
- [x] Catálogo `GcCode` completo
- [x] `/#/recuperar` web y backoffice
- [x] Offline: banner + `canMutate`
- [x] Leaflet en chunk `mapa` + presupuesto bundle
- [x] Firma `pointercancel` + tokens de mapa
- [x] CSP `script-src` sin `unsafe-inline`
- [x] E2E staging specs (Task 7): asesor/jornada, nueva visita, config bloqueada, invite admin, BO 403. Corren en `e2e-staging.yml` post-merge, no en el PR.

PR: `cursor/gate-3-web-runtime-c26b` (no `fix/gate-3-web-runtime`; Cloud Agent).
