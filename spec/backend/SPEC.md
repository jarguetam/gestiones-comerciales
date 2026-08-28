# Spec de Backend — Gestiones Comerciales

**Producto:** Gestiones Comerciales (plataforma genérica multi-rubro)
**Derivado de:** `spec-agromoney-v2.md` (Agromoney Gestiones v2)
**Stack:** Supabase (PostgREST + Edge Functions + Auth + Storage + Realtime) sobre PostgreSQL
**Versión:** 1.0 · 2026-08-26
**Estado:** Borrador para revisión

---

## 1. Principios arquitectónicos

| # | Principio | Aplicación |
|---|-----------|------------|
| B-1 | **Backend como compose, no como servicio monolítico** | No hay API .NET. El backend se compone de: PostgREST (CRUD+RLS), RPC de Postgres (lógica transaccional) y Edge Functions (efectos externos). |
| B-2 | **Cero integraciones externas obligatorias** | El legado dependía de SIFCO y Fortitoken. Aquí todo efecto externo (push, mail, PDF, ETL) es una Edge Function desacoplada con contrato propio. |
| B-3 | **Multi-tenant por diseño** | `tenant_id` + JWT claims + RLS en 100% de tablas de negocio (ver spec DB §3). |
| B-4 | **Lógica de negocio en la capa más cercana al dato** | Validación transaccional → RPC; orquestación/efectos → Edge Function; presentación → frontend. |
| B-5 | **Idempotencia y reintentos** | Toda Edge Function expone `Idempotency-Key` opcional; toda escritura de dispositivo/ubicación usa upsert. |
| B-6 | **Seguridad por defecto** | CORS restringido por tenant (dominios registrados), service_role solo server-side, secrets en Vault de Supabase. |

## 2. Topología

```
                       ┌──────────────────────────────────────────────┐
                       │                 SUPABASE                     │
   App móvil/web ─────►│  Auth (JWT con tenant_id, rol)               │
                       │        │                                     │
                       │        ▼                                     │
                       │  PostgREST ── CRUD con RLS                   │
                       │        │                                     │
                       │        ▼                                     │
                       │  pg_rpc (funciones) ── lógica transaccional  │
                       │        │                                     │
                       │  Edge Functions ── efectos externos          │
                       │   ├─ push-notifications (FCM)                │
                       │   ├─ emailer (Resend/SMTP)                   │
                       │   ├─ pdf-cotizacion / pdf-solicitud          │
                       │   ├─ importer (CSV/Excel catálogos y datos)  │
                       │   ├─ rastreo-ingesta (batch GPS)             │
                       │   ├─ notify-jobs (invocado por pg_cron)      │
                       │   └─ webhook-tenant (integraciones por rubro)│
                       │        │                                     │
                       │  Storage ── bucket privado por tenant        │
                       │  Realtime ── canales por tenant/usuario      │
                       └──────────────────────────────────────────────┘
```

## 3. Autenticación y autorización

### 3.1 Flujos de Auth

| Flujo | Mecanismo | Reemplaza a |
|---|---|---|
| Login email/contraseña | `signInWithPassword` | `POST /Auth` |
| MFA/TOTP | `auth.mfa.challenge/verify` (factor TOTP) | Fortitoken |
| Recuperación de contraseña | `resetPasswordForEmail` + deep-link | endpoint .NET |
| Cambio de contraseña | `auth.updateUser` | `PUT /User/UpdatePassword` |
| Refresh | `supabase-js` auto-refresh | token handler custom |
| Registro de dispositivo (FCM) | upsert en `dispositivo` vía PostgREST | `POST /User/AddTokenDevice` |
| Logout / revocación | signOut + invalidar refresh tokens | — |

**Reglas:**
- El JWT se emite con `app_metadata = {tenant_id, rol}`. Estos claims NO se toman del cuerpo de
  requests, solo del token.
- **Usuarios de plataforma:** su JWT lleva `app_metadata = {plataforma: true, superadmin: bool}`
  (sin `tenant_id`). El backoffice identifica su alcance leyendo `usuario_plataforma` /
  `usuario_plataforma_tenant`; toda operación administrativa pasa por RPC `admin_*` que
  re-verifican membresía y auditan. Un usuario de plataforma nunca accede a las apps de campo.
- Login bloqueado a los 5 intentos fallidos por 15 min (Edge Function `auth-guard` con rate limit
  por `email + IP` sobre tabla `auth_attempts`, o Supabase Rate Limiter nativo).
- Política de contraseñas: mín. 10 caracteres, 1 mayúscula, 1 número (configurable por tenant).

### 3.2 Matriz de permisos (RBAC + RLS)

| Recurso | plataforma | admin | gerente | supervisor | asesor |
|---|---|---|---|---|---|
| Empresas (tenants): alta, plan, branding, activar/desactivar | CRUD (superadmin o asignado) | — | — | — | — |
| Módulos por empresa | activar/desactivar | lectura | — | — | — |
| Usuarios de empresa (invitar, roles, jerarquía) | CRUD (vía RPC admin_*) | CRUD en su tenant | asignación en subárbol | lectura equipo | — |
| Personas (clientes) | — | CRUD | CRUD en su subárbol | CRUD en su equipo | CRUD propias |
| Visitas | — (solo lectura soporte) | CRUD todas | CRUD subárbol | CRUD subordinados | CRUD propias |
| Formularios (respuestas) | — | lectura todas | lectura subárbol | lectura subordinados | crear/leer propias |
| Leads (módulo crm) | — | todo | ver/reasignar subárbol, funnel completo | ver/reasignar equipo, funnel | crear/mover propios |
| Depósitos | — | confirmar/rechazar | confirmar/rechazar subárbol | confirmar/rechazar equipo | crear propios |
| Cuentas/movimientos (módulo creditos) | — | lectura todas | lectura subárbol | lectura subordinados | lectura asignadas |
| Solicitudes + firma | — | todo | revisar/aprobar subárbol | revisar/aprobar equipo | crear propias |
| Rastreo/mapa | — | todo el tenant | subárbol | sus asesores | emitir propia |
| Config (rastreo, estados, catálogos) | — | CRUD | lectura | lectura | — |
| Tenant/branding | CRUD | — | — | — | — |

> La matriz se materializa en políticas RLS (spec DB §3.3) y se re-verifica dentro de cada RPC.
> Las Edge Functions con service_role aplican `tenant_id` explícito en cada statement.

## 4. Contratos de API

### 4.1 PostgREST (CRUD directo)

Las tablas del núcleo y módulos se publican vía PostgREST con los siguientes alcances:

| Recurso | Operaciones | Notas |
|---|---|---|
| `persona` | GET, POST, PATCH | Filtros: `documento`, `asesor_id`, `municipio_id`, `categoria`, `es_registro_generico`. Búsqueda por texto con `or(nombre.ilike.*q*)`. |
| `visita` | GET, POST, PATCH | Filtros: `asesor_id`, `estado_id`, `programada_en` (rango), `persona_id`. Orden por `programada_en`. |
| `visita_estado`, `actividad`, `subactividad`, `actividad_horario`, `zona` | GET | Catálogos del tenant. |
| `departamento`, `municipio` | GET | Compartidos (sin tenant). |
| `dispositivo` | POST, PATCH, DELETE | Registro FCM del propio usuario. |
| `notificacion` | GET, PATCH | Marcar leídas. |
| `rastreo_ubicacion` | POST | Ingesta batch (array). |
| `formulario_respuesta` | POST | Validación vía RPC `formulario_enviar` (preferir RPC). |
| `cuenta`, `movimiento`, `cuenta_saldo` (creditos) | GET | Solo lectura desde el cliente; escritura por ingesta admin. |
| `deposito` | GET, POST, PATCH | PATCH solo para estado (RPC `deposito_confirmar`). |
| `solicitud`, `solicitud_archivo` | GET, POST, PATCH | PATCH limitado por estado del flujo. |
| `kilometraje` | GET, POST, PATCH | Por periodo. |
| `lead`, `lead_estado`, `lead_origen` (crm) | GET, POST, PATCH | `lead` PATCH solo vía RPC `lead_transicion` para estados; alta de leads por asesor o importador. |
| `lead_actividad` (crm) | GET | Timeline por lead (solo lectura). |

**Convenciones PostgREST:**
- Paginación: `Range` header (límite por defecto 50, máx 500). Cursor `id` como fallback.
- Filtros: sintaxis PostgREST (`eq`, `in`, `gte/lte`, `ilike`).
- Embed: `visita?select=*,persona(nombre),actividad(nombre),estado(nombre)`.
- Errores: JSON de error PostgREST (`code`, `message`, `details`). El frontend mapea a mensajes por-tenant (i18n).
- ETag/`Prefer: return=representation` para upserts.

### 4.2 RPC (lógica transaccional)

| RPC | Entrada | Salida | Autorización |
|---|---|---|---|
| `subordinados()` | — | `setof uuid` | autenticado (solo cadena propia) |
| `visitas_del_dia(p_fecha date)` | fecha | tabla de agenda | asesor |
| `visita_checkin(id, lat, lng, precision)` | — | visita actualizada | asesor dueño |
| `visita_checkout(id, observaciones)` | — | visita actualizada | asesor dueño |
| `dashboard_asesor(p_fecha)` | fecha | jsonb agregado | asesor |
| `dashboard_supervisor(p_fecha)` | fecha | jsonb agregado | supervisor/admin |
| `dashboard_gerente(p_fecha, p_supervisor_id?)` | fecha + filtro | jsonb consolidado con drill-down por supervisor | gerente/admin |
| `estructura_comercial()` | — | árbol jerárquico con KPIs por nodo | supervisor/gerente/admin |
| `lead_transicion(id, estado_codigo, motivo?)` | lead + destino | lead actualizado + actividad | asesor dueño; retroceso solo supervisor+ |
| `lead_convertir(id)` | lead | persona (+solicitud) creada | asesor/supervisor |
| `lead_reasignar(id, asesor_id)` | lead + dueño | lead reasignado | supervisor/gerente/admin |
| `crm_funnel(p_desde, p_hasta)` | rango | embudo agregado por estado | asesor (propios) → admin (tenant) |
| `admin_tenant_crear(nombre, rubro, plan, branding)` | datos empresa | tenant + seed inicial | plataforma |
| `admin_tenant_actualizar(id, cambios)` | cambios | tenant actualizado | plataforma |
| `admin_usuario_invitar(tenant_id, email, rol, jefe_id?)` | invitación | usuario creado + email enviado | plataforma o admin del tenant |
| `admin_usuario_gestionar(id, accion, datos)` | acción | usuario modificado | plataforma o admin del tenant |
| `admin_modulo_activar(tenant_id, modulo, activo, config?)` | módulo | tenant_modulo actualizado | plataforma |
| `admin_departamento_guardar(id?, nombre)` | geografía | departamento creado/renombrado | plataforma |
| `admin_municipio_guardar(id?, departamento_id, nombre)` | geografía | municipio creado/renombrado | plataforma |
| `admin_geografia_importar(filas jsonb)` | CSV parseado | {filas, departamentos, municipios} creados | plataforma |
| `admin_modulo_catalogo_guardar(codigo, nombre, nucleo)` | catálogo | módulo upsert | plataforma |
| `admin_plantilla_guardar(id?, rubro, tipo, nombre, payload, activo)` | plantilla base | catalogo_plantilla upsert | plataforma |
| `admin_importar_personas(tenant_id, jsonb)` | lote | resumen {insertados, actualizados, errores[]} | plataforma o admin |
| `admin_importar_cuentas(tenant_id, jsonb)` | lote | resumen {insertados, actualizados, errores[]} | plataforma o admin; exige módulo creditos |
| `admin_importar_catalogos(tenant_id, jsonb)` | lote | resumen {insertados, actualizados, errores[]} | plataforma o admin |
| `admin_webhook_rotar_secret(tenant_id)` | — | secret HMAC (una sola vez) | plataforma |
| `integracion_recibir(...)` | body + firma | evento encolado/procesado | service_role (Edge webhook-tenant) |
| `formulario_enviar(respuesta jsonb)` | documento | resultado + score | asesor |
| `deposito_confirmar(id, estado)` | — | depósito actualizado | supervisor/admin |
| `solicitud_transicion(id, estado_codigo, comentario)` | — | solicitud + historial | según flujo |
| `km_registrar(periodo, km_inicial, km_final)` | — | registro | asesor |
| `importar_personas(jsonb)` | lotes | resumen `{insertados, actualizados, errores[]}` | admin (service_role) |

**Reglas RPC:**
- `security invoker` por defecto; `security definer` solo para `subordinados()` y helpers, con `set search_path` explícito.
- Re-verifican `tenant_id` y alcance de rol internamente.
- Errores de negocio con `RAISE EXCEPTION` usando código `GC-<MODULO>-<NUM>` (ex `GC-CRED-001`), que el frontend mapea a mensaje i18n.

### 4.3 Edge Functions (efectos externos)

| Función | Trigger | Contrato |
|---|---|---|
| `push-notifications` | HTTP (cliente) o notify-jobs | `{tenant_id, usuario_ids[], titulo, cuerpo, datos}` → encola FCM por dispositivo activo; degrada a notificación in-app (`notificacion`). |
| `emailer` | HTTP interno | `{tenant_id, destinatarios[], asunto, html}` → Resend/SMTP. |
| `pdf-solicitud` | RPC trigger (after insert firma) | Genera PDF (plantilla por tenant desde `tenant.branding`) y sube a Storage; actualiza `pdf_ruta`. |
| `importer` | HTTP (admin) | CSV o JSON `{tipo, tenant_id, filas[]}` de personas/cuentas/catálogos → RPC `admin_importar_*` → `{insertados, actualizados, errores[]}`. Excel `.xlsx` se rechaza (`GC-IMP-002`). |
| `rastreo-ingesta` | HTTP (app móvil) | Array de puntos GPS `{lat,lng,precision,velocidad,bateria,capturado_en}`; valida ventana `config_rastreo` y precision_max_m; inserta lote. |
| `notify-jobs` | `pg_cron` vía `pg_net` | Ejecuta jobs genéricos (§7) por tenant activo; orquesta `push-notifications`/`emailer`. |
| `webhook-tenant` | HTTP (sistemas del rubro) | Webhook firmado HMAC-SHA256 (`X-GC-Signature` sobre el body crudo); encola `integracion_evento` y procesa `persona.upsert` / `cuenta.snapshot` / `catalogo.upsert`. |
| `auth-guard` | HTTP | Rate limiting y bloqueo de intentos de login. |
| `pdf-cotizacion` | alias de `pdf-solicitud` | Compatibilidad naming por tenant financiero. |

**Reglas Edge:**
- Deno + TypeScript, cada función en su carpeta bajo `supabase/functions/<nombre>/`.
- `verify_jwt = true` salvo `webhook-tenant` (firma HMAC propia) y `notify-jobs` (secret compartido con pg_cron).
- CORS: `Access-Control-Allow-Origin` solo dominios registrados del tenant (de `tenant.configuracion.dominios`).
- Timeout: 60 s máx (PDF/importaciones grandes → 202 + procesamiento por lotes con reintentos).
- Log estructurado `{ts, tenant_id, funcion, duracion_ms, resultado}` en `supabase_functions.logs` + alertas si error rate > 5%.

### 4.4 Realtime

- Canal `tenant:{id}` para config/catálogos (invalidación de caché del frontend).
- Canal `usuario:{id}` para notificaciones push/in-app en tiempo real.
- Con Realtime Authorization habilitado sobre RLS.

## 5. Validaciones y reglas de negocio (resumen)

| Regla | Capa | Código |
|---|---|---|
| Visita no puede iniciar fuera de ventana horaria de su actividad (±15 min) | RPC `visita_checkin` | GC-CORE-001 |
| Check-out solo si estado `en_proceso` | RPC | GC-CORE-002 |
| Depósito solo confirmable por supervisor/admin y si estado pendiente | RPC | GC-DEPO-001 |
| Firma de solicitud requiere imagen PNG válida (base64) | Edge `pdf-solicitud` | GC-SOLI-001 |
| Formulario válido contra `plantilla.esquema` (JSON Schema) | RPC `formulario_enviar` | GC-FORM-001 |
| Rastreo descarta lecturas con `precision >= precision_max_m` del tenant | Edge `rastreo-ingesta` | GC-RAS-001 |
| Lead: transiciones hacia atrás requieren rol supervisor+ | RPC `lead_transicion` | GC-CRM-001 |
| Lead perdido exige motivo | RPC `lead_transicion` | GC-CRM-002 |
| Lead ganado dispara conversión idempotente a persona | RPC `lead_transicion` | GC-CRM-003 |
| Lead con `persona_id` no retrocede de estado | RPC `lead_transicion` | GC-CRM-004 |
| Reasignar lead de asesor requiere supervisor+ | RPC `lead_reasignar` | GC-CRM-005 |
| Importación: nombre y documento obligatorios | RPC `admin_importar_personas` | GC-IMP-001 |
| Webhook: firma HMAC inválida | RPC `integracion_recibir` / Edge `webhook-tenant` | GC-IMP-010 |
| Webhook sin secret configurado | RPC `integracion_recibir` | GC-IMP-011 |
| Cuentas sin módulo creditos | RPC `admin_importar_cuentas` | GC-IMP-020 |
| Jerarquía: `jefe_id` debe respetar cadena asesor→supervisor→gerente (sin ciclos) | trigger DB | GC-CORE-010 |
| Los códigos de error GC-* se devuelven como `P0001` + mensaje | todas las RPC | — |

## 5b. Backend-for-Frontend opcional (por si un rubro lo exige)

Si un rubro necesita endpoints no cubiertos por PostgREST/RPC (ex integración con ERP), se agrega una Edge Function BFF por rubro (`bff-<rubro>`) con OpenAPI propio. No se acopla el núcleo.

## 6. Jobs programados

Implementados con `pg_cron` + Edge Function `notify-jobs` (detalle de horarios en spec DB §7).
Orquestación:

1. `pg_cron` dispara SQL → selecciona tenants activos con el módulo correspondiente.
2. SQL arma payload `{tenant_id, job}` y llama `net.http_post('notify-jobs')` (pg_net) con header de autorización firmado (secret compartido en Vault).
3. `notify-jobs` ejecuta la lógica del job (consultas agregadas + `push-notifications`/`emailer`).

**Jobs genéricos:** `recordatorio_agenda`, `recordatorio_rastreo`, `cierre_visitas`, `resumen_diario`, `asesores_inactivos`, `recordatorio_kilometraje`, `recordatorio_depositos`, `todo commit de snapshot_cuentas` (módulo creditos).

## 7. Storage

| Bucket | Visibilidad | Estructura | CDF |
|---|---|---|---|
| `firmas` | privado | `{tenant_id}/{solicitud_id}/{uuid}.png` | RLS de Storage por tenant |
| `documentos` | privado | `{tenant_id}/{solicitud_id}/{uuid}.pdf` | idem |
| `importes` | privado | `{tenant_id}/{fecha}/{uuid}.{ext}` | idem |
| `branding` | público | `{tenant_id}/logo.png` | lectura pública por URL firmada corta |

- URLs firmadas (60 min) para descarga desde la app/web.
- Antivirus/scan opcional (ClamAV en Edge) para archivos subidos.
- Límites: 10 MB por archivo, tipos permitidos png/jpg/pdf/xlsx/csv.

## 8. Observabilidad y operación

- **Métricas:** Supabase Log Explorer + logs estructurados por función; dashboards por tenant (error rate, p95 de RPC, FCM entregadas).
- **Alertas:** error rate > 5% en 10 min, `pg_cron` que no corrió en su ventana, FCM rate < 80%.
- **Mantenimiento:** purga de `rastreo_ubicacion` > 180 días, compactación de `auditoria` anual.
- **CI/CD:** migraciones SQL versionadas → preview branch por PR → `supabase db push` en merge. Edge Functions desplegadas por función con smoke tests (`supabase functions deploy`).

## 9. No funcionales (backend)

| ID | Requisito | Objetivo |
|----|-----------|----------|
| NFR-BE-1 | Latencia | p95 < 400 ms en PostgREST/RPC típicos (región única co-locada con DB). |
| NFR-BE-2 | Escalabilidad | 10k asesores concurrentes por tenant sin degradación (pooler Supavisor). |
| NFR-BE-3 | Disponibilidad | 99.5% mensual (SLA Supabase); RTO 4h / RPO 1h (PITR). |
| NFR-BE-4 | Seguridad | OWASP ASVS L2; secretos en Vault; sin `service_role` en cliente. |
| NFR-BE-5 | Idempotencia | Reintentos seguros en todas las escrituras de dispositivo/rastreo (upsert). |
| NFR-BE-6 | Observabilidad | 100% de requests con `request_id` trazable (header propagado a logs). |
| NFR-BE-7 | Multi-región | No requerido en v1; diseño no bloqueante (tenant→región mapeable). |

## 10. Códigos de error y i18n

- Formato: `GC-<MOD>-NNN` (MOD ∈ CORE, AUTH, FORM, SOLI, DEPO, CRED, RAS, CRM, IMP).
- Toda respuesta de error incluye `{code, message, details?}`.
- El frontend mantiene catálogo `locales/{es,en}/errors.json` con traducciones por código.
- Los textos de notificaciones/jobs se generan desde plantillas por tenant (`plantilla_notificacion` en configuración del tenant) — no hardcodeados en la función.

---

## 11. Mapping legado → v2 genérica (resumen)

| Endpoint .NET legado | Destino | Tipo |
|---|---|---|
| `POST /Auth` | `auth.signInWithPassword` | Auth |
| `POST /Auth/ValidationToken` | `auth.mfa.challenge/verify` | Auth |
| `PUT /User/UpdatePassword` | `auth.updateUser` | Auth |
| `POST /User/AddTokenDevice` | `dispositivo` upsert | PostgREST |
| `PUT /User/UpdateLocationStatus` | `usuario.rastreo_activo` PATCH | PostgREST |
| `GET /User/GetBySupervisor{id}` | `rpc subordinados()` | RPC |
| `GET /api/zone` | `zona` GET | PostgREST |
| `GET /api/deparment` | `departamento` GET | PostgREST |
| `GET /api/activitie`, `/api/activitieHour` | `actividad`, `actividad_horario` | PostgREST |
| `GET /api/subactivitie/ByActivitie{id}` | `subactividad?actividad_id=eq.{id}` | PostgREST |
| `GET /api/Municipality/ByDeparment{id}` | `municipio?departamento_id=eq.{id}` | PostgREST |
| `GET /api/Visits/ByUser{id}/{date}/{filter}` | `rpc visitas_del_dia()` | RPC |
| `POST /api/Visits` | `visita` POST | PostgREST |
| `POST /api/Prequal` | `rpc formulario_enviar()` | RPC |
| `POST /api/Cotizacion` (+PDF+firma) | módulo `solicitudes` + Edge `pdf-solicitud` | RPC+Edge |
| Depósitos | `deposito` + `rpc deposito_confirmar()` | PostgREST+RPC |
| Hangfire jobs | `pg_cron` + `notify-jobs` | Jobs |

---

## 12. Checklist de implementación backend

1. [ ] Migraciones DB del spec db aplicadas (núcleo).
2. [ ] Claims `tenant_id`/`rol` en JWT (trigger on auth.users o Admin API).
3. [ ] RLS en 100% de tablas + tests de aislamiento por rol (test por cada tabla × 3 roles).
4. [ ] RPCs núcleo con tests (pgTAP) incluidos `subordinados`, `visita_checkin/checkout`.
5. [ ] Edge Functions: `auth-guard`, `rastreo-ingesta`, `push-notifications`, `notify-jobs`.
6. [ ] Jobs pg_cron desplegados y monitorizados.
7. [ ] Buckets Storage con políticas por tenant.
8. [x] Seed por tenant + `importer` para onboarding de rubros.
9. [ ] Suite de smoke tests end-to-end (login → visita → formulario → notificación).
