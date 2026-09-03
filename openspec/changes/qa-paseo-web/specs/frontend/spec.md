# Capability: frontend — qa-paseo web (delta)

## ADDED Requirements

### Requirement: Catálogo de pantallas web
El harness SHALL definir un catálogo versionado de rutas públicas y autenticadas de `apps/web`
con path hash, id `data-spec` esperado (si aplica) y modo (`public` \| `auth`).

#### Scenario: Rutas admin conocidas
- **WHEN** se carga el catálogo en modo `auth`
- **THEN** incluye dashboard, visitas, personas, CRM, formularios, mapa, solicitudes, depósitos,
  cuentas, kilometraje, notificaciones, auditoría, configuración y usuarios

### Requirement: Recolector de hallazgos
El harness SHALL acumular hallazgos tipados (`crash|blank|redirect|console|network|data-spec|axe|control`)
con severidad, ruta, mensaje y evidencia, sin abortar el paseo ante el primer hallazgo.

#### Scenario: Varios errores en una corrida
- **WHEN** dos pantallas fallan axe y otra emite un error de consola
- **THEN** el reporte final lista los tres hallazgos

### Requirement: Modo public en CI
Sin credenciales, el paseo SHALL visitar login/recuperar y comprobar que rutas autenticadas
redirigen a login (`W-01`), aplicar axe critical/serious y escribir reporte.

#### Scenario: CI sin secretos
- **WHEN** corre `pnpm --filter @gc/web test:e2e` sin `E2E_ADMIN_PASSWORD`
- **THEN** los casos `auth` se omiten y los `public` ejecutan y reportan

### Requirement: Modo auth con MFA env
Con email/password y opcionalmente `E2E_MFA_CODE`, el paseo SHALL autenticar, recorrer el
catálogo auth y listar hallazgos (consola, red 4xx/5xx no esperados, blank, `data-spec`, axe,
controles sin nombre accesible o que rompen la página).

#### Scenario: Admin con MFA
- **WHEN** hay password y código MFA válidos contra la baseURL configurada
- **THEN** cada ruta auth queda visitada y aparece en el reporte (ok o con hallazgos)

### Requirement: BaseURL externa
El harness SHALL poder apuntar a Pages/staging vía `PLAYWRIGHT_BASE_URL` sin levantar
`vite preview` local.

#### Scenario: Paseo contra Pages
- **WHEN** `PLAYWRIGHT_BASE_URL=https://jarguetam.github.io/gestiones-comerciales/` y
  `PLAYWRIGHT_NO_SERVER=1`
- **THEN** Playwright no arranca preview y navega esa URL
