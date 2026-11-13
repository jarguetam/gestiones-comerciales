# Hábitat en Gestiones Comerciales — Roadmap y fases

**Fecha:** 2026-11-13
**Autor:** Josue Argueta (con Claude)
**Estado:** borrador para aprobación
**Base medida:** `jarguetam/gestiones-comerciales`, rama `origin/main` en `a3d86d3` (2026-10-03)
**Insumos:** reunión con Luis Alberto Martínez (2026-11-11), Excel «programación oficiales de cartera Habitat», organigrama enviado por Josue (2026-11-13), audio de Luis por WhatsApp (2026-11-12)

> Este documento vive por ahora en `C:\Proyectos\gestiones-comerciales\docs\superpowers\specs\`. Cuando arranque la implementación se copia al repo, en `docs/superpowers/specs/`, en una rama nueva desde `origin/main` (decisión de Claude).

---

## 1. Intención

Luis Alberto Martínez gestiona el negocio de crédito para construcción en Hábitat (Honduras). Tiene dos problemas concretos:

1. **No sabe en qué gasta el tiempo su gente.** Los oficiales no planifican el día, y Luis necesita mostrarle a gerencia general cuánto tiempo se dedica a cada actividad: cobros, programas y subsidios, desarrollo de recursos, negocios o labores administrativas.
2. **Los depósitos bancarios se reportan a mano.** El 90% de los cobros se depositan en bancos. Los oficiales transcriben las boletas a un Drive, con errores y duplicados.

Además quiere aprobación de actividades, rastreo GPS y que ninguna actividad se cierre «desde la hamaca», es decir, lejos del cliente.

Hábitat no tiene presupuesto. Por eso se incorpora como **una empresa más (tenant) en la plataforma Gestiones Comerciales, en la nube Supabase de Josue**. La instalación en servidores propios de Hábitat queda para después.

## 2. Metas, no metas y anti-metas

**Metas**
- Los 21 usuarios de Hábitat entran a la plataforma y los 14 de campo usan la app a diario.
- Cada oficial programa su día con actividad, subactividad y bloque de horas.
- Los aprobadores de cada oficina aprueban o rechazan las actividades de su equipo.
- Luis ve todas las gestiones de todas las oficinas y obtiene un reporte de horas por actividad para gerencia.
- Los depósitos se registran en la app con banco, referencia y foto, sin poder duplicarse.
- Una actividad con cliente no se cierra si el oficial no está en el lugar.
- Los tres ambientes (web de la empresa, app y backoffice de plataforma) quedan documentados.

**No metas** (decididas o fuera de este roadmap)
- Permiso «ver todo» o varios roles por usuario. Josue lo dejó fuera el 2026-11-13 y se lo explicará a Luis.
- Rutas inteligentes (Luis: «después»).
- Instalación en servidores de Hábitat (decidido el 2026-11-12: nube de Josue).
- Publicar en Play Store e iOS. La app se distribuye como APK interno.
- Módulos `crm`, `solicitudes`, `kilometraje` y `creditos` (cartera y mora). Quedan apagados para Hábitat.
- Medir el tiempo real entre check-in y cierre. El reporte usa los bloques de horas estimadas, igual que el Excel de hoy.

**Anti-metas** (cosas que harían fracasar el proyecto aunque «funcione»)
- **Romper otras empresas.** Producción es un solo proyecto multi-tenant. Todo comportamiento nuevo se activa por empresa y por defecto conserva el comportamiento actual.
- **Perder registros de campo.** Nada en la cola offline puede perderse en silencio.
- **Un arranque fallido frente a 21 personas** por app que no instala, rastreo que no corre o contraseñas que no llegan. Sale caro en credibilidad con Luis.
- **Una geocerca que bloquee a quien sí está en el lugar** por la imprecisión del GPS.

## 3. Punto de partida

Medido sobre el código, no solo sobre la existencia de archivos. El peso es esfuerzo relativo (1–8); el avance es mi estimación.

| # | Requerimiento | Peso | Hecho | Evidencia y qué falta |
|---|---|:-:|:-:|---|
| 1 | Alta de empresa, módulos y catálogos editables | 5 | 100% | `apps/backoffice/src/features/empresas/WizardEmpresa.tsx`, `apps/web/src/features/configuracion/CatalogosPage.tsx` |
| 2 | Usuarios y jerarquía | 5 | 100% | Edge `invitar-usuario`; trigger `validar_jerarquia_usuario` |
| 3 | Planificación diaria (web y app) | 8 | 65% | `visita_crear`, `NuevaVisitaModal.tsx`, `VisitasPage.tsx`. Falta poder registrar actividades sin cliente: `visita_crear` exige cliente, zona, departamento y municipio. **Además, toda actividad se graba con la primera zona activa** (`cargarDominio.ts:122`, `catalogosCampo.ts:46`) **y con un departamento y municipio arbitrarios** (consulta `limit(1)` sin orden) |
| 4 | Check-in y cierre con GPS, sin conexión | 8 | 75% | El check-in y el cierre sí pasan por la cola (`cola.ts`, `sync.ts`). **Pero la agenda se lee en vivo** (`visitas_del_dia` en `AgendaScreen.tsx`, sin caché) **y el alta llama a `visita_crear` directo** (`apps/mobile/src/lib/supabase.ts:91`): sin señal no se ve la agenda ni se programa |
| 5 | No dejar cerrar lejos del cliente | 5 | 20% | `apps/mobile/src/lib/geocerca.ts` solo avisa a 200 m (fijo en `AgendaScreen.tsx:39`), no bloquea, mide contra las coordenadas de la propia visita y no se valida en el servidor |
| 6 | Ubicación del cliente | 3 | 15% | Existe `persona.coordenada`, pero ni el importador ni la app la llenan |
| 7 | Aprobación de actividades | 5 | 50% | El RPC `visita_revisar` existe, pero ninguna pantalla web o móvil lo llama |
| 8 | Rastreo GPS y mapa | 8 | 90% | `rastreoServicio.ts`, Edge `rastreo-ingesta`, `config_rastreo`, `MapaPage.tsx`. Sin probar en teléfono real |
| 9 | Reporte de horas por actividad | 5 | 10% | Se guarda `actividad_hora`; los tableros solo cuentan visitas del día |
| 10 | Depósitos completos | 5 | 40% | Hay tabla, confirmación y pantallas. Faltan banco y llave única, `referencia` acepta nulos y la foto se toma pero no se sube (`DepositosScreen.tsx:81`) |
| 11 | Geografía por país | 2 | 50% | Se importa por CSV en el backoffice, pero las tablas son globales y el seed solo trae Guatemala |
| 12 | App instalable | 3 | 50% | Hay un AAB de diagnóstico (2026-09-26) contra producción y un perfil EAS `preview` que genera APK. No se ha distribuido |

**Total: 37.35 de 62 puntos ≈ 60% hecho, falta ≈ 40%** (rango razonable: 35–45%). Cargar catálogos y usuarios es configuración y no cuenta como «construir».

La primera estimación (65%) bajó tras la revisión independiente del 2026-11-13. Encontró que la oficina y la geografía de cada actividad se graban mal y que la app no programa sin señal.

**Preparación de producción (aparte y sin verificar):**
- El Gate 6 (go-live) sigue abierto.
- `prepare-android-pilot` tiene 13 tareas abiertas, entre ellas la prueba en dispositivo real.
- El README cita 42 migraciones; `main` tiene 46. No pude confirmar cuáles están aplicadas en producción.

## 4. Restricciones

- **Producción compartida.** Proyecto Supabase `xcoeipsnykceorcvjwve`. Toda migración es forward-only y corre para todas las empresas (`docs/runbooks/migrations.md`).
- **Flujo del repo** (`AGENTS.md`):
  - Cada funcionalidad nueva empieza con `openspec/changes/<nombre>/`, con propuesta, specs WHEN/THEN y tareas.
  - Un tema = una rama = un PR.
  - pgTAP para SQL; toda nueva `SECURITY DEFINER` se agrega al allowlist.
  - Errores al usuario con código `GC-*`.
- **Un rol por usuario** (`admin`, `gerente`, `supervisor`, `asesor`). Cadena obligatoria: asesor → supervisor → gerente. Admin y gerente no tienen jefe. Todo asesor requiere supervisor.
- **Visibilidad.** Cada quien ve lo suyo y lo de su subárbol; `admin` ve todas las visitas. El tablero de un `admin` sale vacío porque no tiene subárbol. Se acepta.
- **Alta de usuarios.** Solo el superadmin de plataforma (Josue, con MFA AAL2) da de alta usuarios desde el backoffice, con contraseña inicial. Recuperar contraseña depende del SMTP de Auth, sin verificar (Gate 6).
- **Sin acceso directo a producción desde la PC de trabajo.** El conector Supabase de Claude ve otra organización (GastosAPP); no hay token de la CLI ni `gh`.
- **Android solamente.** iOS está fuera.

## 5. Enfoques considerados

| Enfoque | Qué implica | Costo |
|---|---|---|
| **Todas las oficinas a la vez, por entregas** ✅ *elegido por Josue* | Se configura todo y arrancan las 21 personas. Las brechas salen en entregas sobre la marcha | Una falla de app o de acceso le pega a todos a la vez |
| Oficina piloto y luego todas | Una oficina 1–2 semanas, después las otras seis | Arranque completo más lento; era la recomendación de Claude por el riesgo de la app en campo |
| Construir todo primero | Luis estrena todo junto, sin soluciones temporales | Varias semanas sin uso; el rastreo no se prueba en campo hasta el final |

**Por qué funciona el enfoque elegido:** lo que se registra desde el primer día se puede aprobar y reportar después. Una visita completada queda esperando aprobación, y las horas ya se guardan con cada actividad. El riesgo de arrancar con todos se mitiga con la prueba en teléfonos reales de la Fase 0 (criterio de salida obligatorio).

## 6. Organización de Hábitat en la plataforma

Correos `@habitathn.org`. Los marcados con † son supuestos que hay que confirmar (§10).

| Usuario | Rol | Jefe | Oficina (zona) |
|---|---|---|---|
| luis.martinez † | gerente | — | — |
| ana.medina † | admin | — | — |
| maricela.lendos | supervisor | luis.martinez | Santa Rosa |
| luis.lopez | supervisor | luis.martinez | San Pedro Sula |
| amilcar.matamoros | supervisor | luis.martinez | Siguatepeque y Tegucigalpa |
| cesar.gonzales † | supervisor | luis.martinez | Santa Cruz |
| marlon.reyes † | supervisor | luis.martinez | Aguán y La Ceiba |
| pedro.alvarado | asesor | maricela.lendos | Santa Rosa |
| jorge.miranda | asesor | maricela.lendos | Santa Rosa |
| cinthia.lopez | asesor | luis.lopez | San Pedro Sula |
| wilmer.osorio | asesor | luis.lopez | San Pedro Sula |
| edson.diaz | asesor | amilcar.matamoros | Siguatepeque |
| winston.amaya | asesor | amilcar.matamoros | Siguatepeque |
| kevin.amador | asesor | amilcar.matamoros | Tegucigalpa |
| alirio.anariba | asesor | amilcar.matamoros | Tegucigalpa |
| ernesto.mejia | asesor | cesar.gonzales | Santa Cruz |
| florentino.castillo | asesor | cesar.gonzales | Santa Cruz |
| edelia.hernandez | asesor | marlon.reyes | Aguán |
| gerson.argueta | asesor | marlon.reyes | La Ceiba |
| linton.mejia | asesor | **pendiente** | **pendiente** (cobros) |
| nelson.munguia † | asesor | **pendiente** | **pendiente** (cobros) |

**Total: 21 usuarios** (1 gerente, 1 admin, 5 supervisores, 14 asesores).

- **Oficina para reportes:** es la zona del usuario (`usuario.zona_id`), no la grabada en la visita. Cada asesor pertenece a una sola oficina.
  - Amilcar y Marlon cubren dos oficinas, pero se les asigna una sola zona (la primera de su lista). Sus asesores sí quedan en la oficina correcta.
  - *(decisión de Claude)*
- **Actividades propias de los supervisores:** pueden registrarlas y cuentan como «ejecutadas» en el reporte. No requieren aprobación, porque por encima solo está Luis y Luis no aprueba. *(decisión de Claude)*
- **Aprobación:** se aprueba la actividad ya completada, no el plan. Luis pidió «la misma lógica» de Agromoney, donde el supervisor aprueba o rechaza visitas completadas (reunión 2026-11-11).
- Marlon Reyes también figura como «administrador». Por la regla de un rol, queda solo como supervisor.
- «Merlon.reyes» en Ceiba se asume errata de Marlon.
- Luis Martínez podría aprobar técnicamente (toda la cadena hacia arriba puede), pero no lo hará.

## 7. Catálogos de Hábitat

Tomados del Excel (hoja «Programación»). Las erratas se corrigen salvo que Luis diga lo contrario (§10).

**Zonas (oficinas):** Santa Rosa, San Pedro Sula, Siguatepeque, Tegucigalpa, Santa Cruz, Aguán, La Ceiba. Sustituyen al Excel, que tenía Copán dos veces y no tenía Santa Cruz.

**Actividades y subactividades (5 / 30):**

| Actividad | Subactividades |
|---|---|
| Cobros | Pre cobro · Cobro 1–30 días · Cobro 31–60 días · Cobro 61–90 días · Cobro 91–120 días · Cobro más de 120 días · Visita con abogado · Campaña de recuperación |
| Administrativas | Capacitación personal de Hábitat · Dedicación de vivienda · Devocional · Vacaciones · Permisos · Incapacidad |
| Programas | Capacitación beneficiarios subsidios · Caracterización de familias · Juntas con cooperantes · Firma de acuerdos |
| Desarrollo de recursos | Brigadas internacionales · Brigadas locales · Actividades de captación de recursos · Juntas con cooperantes · Firma de acuerdos |
| Negocios | Promoción · Prospección · Documentación de prospectos · Análisis de prospectos · Comité de crédito · Capacitación de beneficiario · Investigación legal de terrenos |

- **Erratas corregidas:** «Activades» → Actividades, «Campña» → Campaña, «Cometé» → Comité, «Analisis» → Análisis.
- **Cobro mayor a 120 días:** el Excel dice «> 121 días», lo que dejaría fuera el día 121. Se usa «más de 120 días».

**Bloques de horas (8):** 0–1 h = 1 · 1–2 h = 2 · 2–3 h = 3 · 3–4 h = 4 · 4–5 h = 5 · 5–6 h = 6 · 6–7 h = 7 · 7–8 h = 8.

Los catálogos de relleno que crea el asistente de alta («Zona 1», «Visita comercial / Seguimiento», «30 minutos / 1 hora / 2 horas») se **desactivan**, no se borran.

## 8. Roadmap

```
Fase 0  Preparación (configuración + E0 + app instalable + prueba en campo)
Fase 1  Arranque de las 7 oficinas con soluciones temporales
Fase 2  Entregas E1 → E6 (+ E7 condicional), una por OpenSpec change / PR
Fase 3  Documentación de los 3 ambientes y manuales ──────────────────── en paralelo desde la Fase 0
Fase 4  Después (fuera de este roadmap)
```

### Fase 0 — Preparación

Configuración y empaquetado. El único código es E0: correcciones mínimas sin las cuales los datos del arranque saldrían mal. Las escrituras en producción se muestran antes de ejecutarse y Josue las aprueba una por una.

| # | Tarea | Depende de |
|---|---|---|
| 0.1 | **Acceso operativo a producción.** Reconectar el conector Supabase a la organización GestionesComerciales o dejar un token de la CLI. Confirmar qué migraciones de `main` están aplicadas | Josue |
| 0.2 | **Empresa Hábitat.** Verificar si existe; si no, crearla en el backoffice. Solo el módulo núcleo; `depositos` apagado hasta E4. Nombre oficial y logo | 0.1, datos de Luis |
| 0.3 | **Geografía de Honduras.** 18 departamentos y sus municipios, por CSV en el backoffice (panel Geografía) desde la lista oficial | — |
| 0.4 | **Catálogos de §7.** Cargar zonas, actividades, subactividades y bloques de horas; desactivar los de relleno | 0.2 |
| 0.5 | **Horario de rastreo** (`config_rastreo`). Propuesta mientras Luis confirma: lunes a viernes 07:30–17:30, sábado 07:30–12:30, domingo sin rastreo, cada 20 min, precisión máxima 100 m | 0.2, Luis |
| 0.6 | **Usuarios de §6** en este orden: gerente → admin → supervisores → asesores. Contraseñas iniciales entregadas en privado a cada persona, nunca en grupo | 0.2, correos confirmados |
| 0.7 | **Base de clientes.** Importar por CSV (`importer`, tipo `personas`) si Luis la comparte. Las coordenadas se importan hasta E5 | Luis |
| 0.8 | **App instalable.** Build EAS `preview` (APK interno) contra producción, con enlace de instalación | — |
| 0.9 | **Prueba en teléfonos reales** (al menos dos marcas, idealmente las que usan los oficiales): login, permiso de ubicación «siempre», rastreo de una jornada completa en segundo plano, modo avión → reconexión sin pérdida, check-in y cierre, recuperación de contraseña | 0.6, 0.8 |
| 0.10 | **Manuales cortos por perfil** (asesor, aprobador, gerente, administrador), incluidas las soluciones temporales de la Fase 1 | 0.9 |
| 0.11 | **E0 — Correcciones mínimas antes del arranque** (código; ver Fase 2). Es la única excepción a «sin código» en esta fase | — |
| 0.12 | **Respaldo y restauración.** Verificar que el respaldo diario cifrado (`ops-backup-prod.yml`) corre y hacer un ensayo de restauración antes de cargar datos reales de Hábitat *(decisión de Claude)* | 0.1 |

**Criterio de salida:**
- Cada uno de los 21 usuarios entra.
- Un asesor de prueba programa, hace check-in y cierra una actividad, y Luis la ve en Visitas y en el tablero.
- Aparece un recorrido en el mapa.
- 0.9 pasa sin bloqueantes abiertos.

Si la recuperación de contraseña por correo no funciona, se arranca igual y los reinicios los hace Josue desde el backoffice. Queda anotado como riesgo.

### Fase 1 — Arranque de las 7 oficinas

- Una capacitación remota por perfil y una semana de acompañamiento. Josue revisa a diario qué oficiales programaron.
- Canal de soporte: WhatsApp con Josue.
- Indicador de adopción: porcentaje de asesores con al menos una actividad programada por día hábil.

**Soluciones temporales hasta que salgan las entregas:**

| Falta | Mientras tanto | Se resuelve en |
|---|---|---|
| Aprobación | Las actividades quedan «completada» y se aprueban en lote cuando salga E1 | E1 |
| Actividades sin cliente | Se registran contra el cliente genérico «Hábitat (interno)» (`persona.es_registro_generico`), con la zona de su oficina | E2 |
| Reporte de horas | Los datos se acumulan; el reporte los cubrirá hacia atrás | E3 |
| Depósitos | Siguen como hoy (Drive). El módulo no se enciende hasta E4, para no juntar depósitos sin banco | E4 |
| Cierre lejos del cliente | Solo se audita (coordenadas del check-in), no se bloquea | E5 |

### Fase 2 — Entregas

Orden por valor para Luis. Cada entrega es un `openspec/changes/<nombre>/` con su PR, pruebas (unitarias, pgTAP o e2e) y despliegue: migraciones por `supabase-prod`, web por Pages y un APK nuevo si toca la app.

**Todo cambio de comportamiento queda detrás de configuración por empresa y por defecto apagado**, para no alterar a las otras empresas.

#### E0 — Correcciones mínimas y modo sin señal antes del arranque · tamaño M–L
Sale dentro de la Fase 0, antes de que entren los 21 usuarios. Josue confirmó el 2026-11-13 que hay zonas sin señal, así que el modo sin señal entra completo.
- **Oficina correcta en cada actividad.** `zona_id` toma la zona del usuario, no la primera de la lista. Aplica a web (`cargarDominio.ts`, `persistir.ts`) y app (`catalogosCampo.ts`).
- **Geografía correcta.** Departamento y municipio salen del cliente vinculado; si no hay cliente, de la oficina. Para eso la zona necesita su departamento y municipio por defecto (columnas nuevas, opcionales). Nunca de una fila arbitraria.
- **Agenda y alta sin señal:**
  - La agenda de los próximos días se guarda en el teléfono y se muestra sin conexión.
  - **Catálogos y clientes en caché local.** Hoy solo la cola vive en SQLite (`colaPersistencia.ts`); actividades, subactividades, horas y la lista de clientes del asesor se leen en línea. La caché debe incluir la ubicación de cada cliente para la validación local de E5.
  - «Agendar» pasa por la cola con `cliente_key` (el tipo `visita` ya existe en `sync.ts`, pero nadie lo encola).
  - **Una actividad creada sin señal debe admitir check-in y cierre sin señal** antes de existir en el servidor. Los ítems de la cola se ligan por `cliente_key`, no por el id del servidor, y la sincronización respeta el orden: crear → check-in → cerrar.
  - El estado del check-in se guarda, no queda solo en memoria.
  - La pantalla Sincronización muestra pendientes y errores, y nada se borra de la cola sin confirmación del servidor.
- **Listo cuando:**
  - Una actividad creada en web o app queda con la oficina del asesor y una geografía de Honduras válida.
  - En modo avión, con la app recién abierta, el asesor ve su agenda, programa una actividad nueva, le hace check-in y la cierra. Al reconectar todo llega una sola vez y en orden (prueba en dispositivo real como parte de 0.9).

#### E1 — Bandeja de aprobación (web) · tamaño S–M
- En Visitas, un filtro «Por aprobar» (estado `completada` de su subárbol) con acciones **Aprobar** y **Rechazar**. El rechazo exige comentario.
- Aprobación en lote.
- Usa `visita_revisar` tal como está; no requiere migración.
- En el detalle de la visita, mostrar las coordenadas del check-in y, si el cliente tiene ubicación, la distancia. Así se audita antes de E5.
- **App:** el asesor ve las rechazadas con su motivo y puede corregirlas (el RPC `visita_corregir` ya existe; falta en la cola móvil).
- La bandeja solo lista actividades de asesores; las de supervisores no requieren aprobación (§6).
- **Listo cuando:** un supervisor aprueba y rechaza solo dentro de su subárbol (e2e), y el asesor ve el motivo del rechazo.

#### E2 — Tipos de lugar por subactividad · tamaño M
Dos banderas por subactividad, con valores por defecto que dejan a las otras empresas igual que hoy:

| Bandera | Defecto | Significado |
|---|---|---|
| `requiere_cliente` | `true` | Si es `false`, la actividad no lleva cliente ni geografía (vacaciones, devocional), ni check-in ni geocerca. La oficina se toma del usuario |
| `aplica_geocerca` | `false` | Si es `true`, la actividad exige elegir un cliente de la lista (no texto libre) y en E5 se valida la distancia al cerrar |

- Las demás actividades (comité de crédito, juntas, brigadas, promoción) registran el check-in GPS como evidencia, pero no bloquean.
- **Migración (expand):** quitar el `not null` de `persona_nombre`, `departamento_id`, `municipio_id` y `zona_id` en `visita`. La obligatoriedad pasa al RPC según la bandera.
- **Propuestas** (Luis confirma, §10):
  - Sin cliente: Capacitación personal de Hábitat, Devocional, Vacaciones, Permisos, Incapacidad.
  - Con geocerca: Pre cobro y los cinco rangos de cobro.
- **Listo cuando:** pgTAP cubre las combinaciones de banderas; una vacación se crea y se cierra desde la app sin GPS; una actividad con geocerca no se puede crear sin elegir cliente.

#### E3 — Reporte de horas por actividad · tamaño M
- RPC `reporte_horas_actividad(desde, hasta, zona?, usuario?)` con el alcance del que consulta (lo suyo y su subárbol; `admin` ve todo).
- Agrupa por oficina, asesor, actividad y subactividad, con tres columnas de horas, todas sumando `actividad_hora.cantidad`:
  - **Planificadas:** todas menos las anuladas.
  - **Ejecutadas:** completadas y aprobadas.
  - **Aprobadas.**
- Pantalla web nueva, «Reporte de horas», para gerente, supervisor y admin:
  - Filtros de fechas, oficina y asesor.
  - Tabla y gráfico de % del tiempo por actividad.
  - Exportación CSV en UTF-8 con BOM, para que Excel lo abra bien (reutiliza `apps/web/src/lib/csv.ts`).
- **Listo cuando:** pgTAP del alcance (un supervisor no ve otra oficina) y los totales cuadran con una muestra manual.

#### E4 — Depósitos completos · tamaño M–L
- Catálogo `banco` por empresa (código, nombre, activo), administrable en Configuración.
- `deposito` agrega:
  - `banco_id`
  - `fecha_deposito`
  - cliente opcional (`persona_id` o nombre)
  - `comprobante_ruta`
  - los campos que resulten de aclarar qué es el «código de banco» de Luis (§10)
- **Llave única** sobre empresa + banco + referencia normalizada (sin espacios, en mayúsculas).
  - Índice parcial `where banco_id is not null and estado <> 'rechazado'`: no afecta datos existentes, y una boleta rechazada por error de digitación se puede volver a registrar.
  - Un duplicado devuelve `GC-DEPO-002`: «Esta boleta ya fue registrada».
- **Quién confirma:** el supervisor de la oficina y Ana (admin), como hoy permite `deposito_confirmar`. La pantalla web exporta CSV por si contabilidad concilia fuera de la plataforma.
- **Foto en Storage privado.** La app sube la foto aunque se haya tomado sin conexión (la cola debe guardar el archivo local). La web la muestra con URL firmada.
- Al salir se enciende el módulo `depositos` para Hábitat.
- **Listo cuando:** pgTAP del duplicado; la foto tomada en modo avión llega al servidor al reconectar; el supervisor ve la foto y confirma.

#### E5 — Cierre con geocerca y ubicación del cliente · tamaño L
- **Configuración por empresa:** `geocerca_modo` (`apagado` | `aviso` | `bloqueo`) y `geocerca_radio_m`. Hábitat va en `bloqueo`, con el radio que confirme Luis (§10).
- **Punto de referencia:** `persona.coordenada`, no las coordenadas de la propia visita. Hay que corregir `avisoGeocerca`.
- **Validación en el servidor** dentro de `visita_completar`. Usa las coordenadas y la precisión capturadas al momento del cierre, que viajan en la cola. Fuera del radio → `GC-VIS-0xx`.
- **La app valida antes de encolar**, con la ubicación del cliente en caché, para que el rechazo no llegue días después en una sincronización.
- **Si el cliente no tiene ubicación:** «Fijar ubicación del cliente» en el check-in. Queda con `verificacion_estado = 'pendiente'` hasta que el supervisor la confirme en la web. Mientras esté pendiente no se bloquea, para no frenar la operación, pero se marca.
- **Importador de personas:** columnas `latitud` y `longitud`, para cargar la base georreferenciada de Luis. Las coordenadas que importa un admin entran como `verificada`.
- **Salida para quien sí está en el lugar y queda fuera del radio** *(decisión de Claude; anti-meta 4)*:
  - Si la precisión de la lectura es peor que el radio, la app pide reintentar.
  - Tras dos reintentos, permite «Cerrar con justificación». La actividad se cierra marcada `fuera_de_geocerca`, con la distancia y el motivo (cliente atendido en otro sitio, cambio de domicilio, ubicación mal tomada).
  - En la bandeja del aprobador sale resaltada y el aprobador decide.
  - Así nadie cierra a escondidas desde la casa: cerrar lejos queda siempre a la vista del aprobador.
- Solo aplica a subactividades con `aplica_geocerca` (E2) vinculadas a un cliente.
- **Listo cuando:** pgTAP del bloqueo, de la justificación y del modo apagado (otras empresas sin cambio); un cierre fuera del radio sin justificación se bloquea en la app y en el servidor.

#### E7 — Cartera compartida para cobros · condicional
Solo si Luis confirma que Linton y Nelson cobran clientes asignados a otros oficiales (§10 #2). Hoy un asesor solo ve los clientes con su `asesor_id` (política `alcance_persona`), así que no podría vincularlos a la actividad ni aplicarles geocerca. Requiere un cambio de visibilidad (por ejemplo, clientes en mora visibles para usuarios de cobro), que toca seguridad. Se diseña en su propio OpenSpec si aplica.

#### E6 — Geografía por país · tamaño S
- `pais` en `departamento` y en `tenant`. Los selectores filtran por el país de la empresa.
- Sale al final; si los oficiales se confunden con la lista mezclada de Guatemala y Honduras, se adelanta.

### Fase 3 — Documentación de los 3 ambientes (en paralelo)

En el repo, en `docs/ambientes/`:

| Documento | Contenido |
|---|---|
| `web.md` | Web de la empresa (`apps/web`): propósito, roles y qué ve cada uno, pantallas W-xx, configuración por empresa, flujos (planificar → ejecutar → aprobar → reportar; depósitos), códigos `GC-*` frecuentes, despliegue por Pages |
| `mobile.md` | App (`apps/mobile`): pantallas M-xx, permisos, cola offline y sincronización, rastreo (horarios, batería, marcas de teléfono), builds EAS y distribución por APK, solución de problemas |
| `backoffice.md` | Tu backoffice (`apps/backoffice`): alta de empresa, módulos, geografía, plantillas, salud, MFA de plataforma, alta y baja de usuarios |
| `habitat.md` | Runbook de la empresa Hábitat: organigrama vigente, catálogos, configuración, soluciones temporales activas, contactos |
| `manuales/` | Manuales por perfil (asesor, aprobador, gerente, administrador) con capturas |

Cada documento se actualiza al cerrar cada entrega.

### Fase 4 — Después (fuera de este roadmap)

- Permiso «ver todo» o multirol (Marlon y Ana).
- Tablero para `admin`.
- Rutas inteligentes con la ubicación de clientes.
- Instalación en servidores de Hábitat (Supabase autoalojado).
- Play Store; iOS.
- Módulo de créditos (cartera y mora) para alimentar cobros.
- Tiempo real medido entre check-in y cierre.

## 9. Avance esperado

| Hito | Puntos que cierra | % hecho acumulado |
|---|:-:|:-:|
| Hoy | — | 60% |
| Fase 0 (E0, rastreo validado, APK) | 5.1 | 68% |
| E1 Aprobación | 2.5 | 72% |
| E2 Tipos de lugar | 2.0 | 76% |
| E3 Reporte de horas | 4.5 | 83% |
| E4 Depósitos | 3.0 | 88% |
| E5 Geocerca y ubicación | 6.55 | 98% |
| E6 Geografía por país | 1.0 | 100% |

E7 es condicional y no está en la base de 62 puntos. Si aplica, se suma como trabajo nuevo.

## 10. Datos pendientes de Hábitat

| # | Dato | Bloquea |
|---|---|---|
| 0 | ~~¿Los oficiales trabajan donde no hay señal?~~ **Respondido (2026-11-13): sí.** E0 incluye el modo sin señal completo | — |
| 1 | Confirmar correos: luis.martinez, ana.medina, cesar.gonzales, nelson.munguia; ¿«Merlon» es Marlon? | 0.6 |
| 2 | Cobros (Linton Mejía, Nelson Munguía): a quién reportan, de qué oficina son y si cobran clientes asignados a otros oficiales | 0.6 (esos 2 usuarios); E7 |
| 3 | Horario de jornada para el rastreo | 0.5 (hay propuesta por defecto) |
| 4 | Nombre oficial de la empresa y logo | 0.2 (no bloquea) |
| 5 | Base de clientes: formato, si trae DNI y oficial asignado (el importador los exige) y si tiene coordenadas | 0.7, E5 |
| 6 | Marcas y modelos de teléfono de los oficiales | 0.9 |
| 7 | Qué subactividades van sin cliente y cuáles con geocerca | E2 (hay propuesta) |
| 8 | Lista de bancos y una boleta de ejemplo: qué es el «código de banco» y qué combinación no puede repetirse. Quién concilia hoy los depósitos del Drive | E4 |
| 9 | Radio de la geocerca: Luis pidió 20 m; con GPS de teléfono se recomiendan 50 m. Que Luis acepte el «cierre con justificación» de E5 | E5 |
| 10 | Confirmar las erratas corregidas de §7 | 0.4 (no bloquea) |

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| El rastreo en segundo plano se cae en ciertas marcas (ahorro de batería) | Prueba 0.9 en las marcas reales y una guía de ajustes por marca en el manual del asesor |
| Una migración afecta a otras empresas | Banderas por empresa apagadas por defecto, pgTAP del caso «apagado» y la ruta de despliegue que ya tiene el repo |
| El SMTP de Auth no está verificado | Contraseñas iniciales entregadas por Josue; reinicios desde el backoffice |
| Contraseñas iniciales filtradas | Entrega individual y privada; cambio en el primer ingreso (verificar si la app lo fuerza) |
| GPS impreciso contra un radio de 20 m | Radio configurable, precisión del lector registrada y validación previa en la app |
| Un cierre offline rechazado al sincronizar | Validación local antes de encolar y errores visibles en la pantalla Sincronización |
| Sin acceso a producción desde la PC de trabajo | Tarea 0.1 antes de cualquier configuración |
| Josue es el único operador | Runbook `habitat.md` y manuales; soporte por WhatsApp con horario acordado |
| E0 (modo sin señal) atrasa el arranque | Es lo más grande antes del arranque. Si se alarga, se puede arrancar con las oficinas urbanas (SPS, Tegucigalpa, La Ceiba) y sumar las rurales al cerrar E0. Lo decide Josue en el momento |

## 12. Decisiones y supuestos

**Decididas por Josue**
- Nube de Josue, no servidores de Hábitat.
- Luis es gerente, ve todo y no aprueba.
- Aprobadores por oficina.
- Sin permiso «ver todo» ni multirol.
- Todas las oficinas a la vez, por entregas.
- Hay zonas sin señal: la app debe planificar y operar sin conexión desde el arranque.

**Respondido por la reunión con Luis**
- Se aprueba la actividad completada, con la misma lógica de Agromoney.

**Supuestos de Claude** (corregibles)
- Ana es admin y Marlon es supervisor.
- «Merlon» es Marlon.
- Formato de correos.
- Corrección de erratas.
- Horario de rastreo por defecto.
- Subactividades sin cliente y con geocerca.
- Columnas del reporte (planificadas, ejecutadas, aprobadas).
- Exportación en CSV.
- Ubicación del cliente con verificación del supervisor; coordenadas importadas entran como verificadas.
- Oficina = zona del usuario.
- Supervisores registran sus actividades sin aprobación.
- E0 de código dentro de la Fase 0.
- Respaldo y ensayo de restauración antes de los datos reales.
- Cierre con justificación cuando la geocerca falla.
- Boletas rechazadas fuera de la llave única.
- Orden de las entregas y ubicación de este documento.

## 13. Lo que queda al constructor

- Nombres de columnas, códigos `GC-*` nuevos y diseño visual de las pantallas, dentro del kit UI y de `docs/frontend/design-system.md`.
- Cómo guarda la cola móvil los archivos de foto offline (E4).
- Si E1 incluye notificación push al asesor cuando le rechazan una actividad (la tabla `notificacion` ya existe).
- La fuente oficial de la geografía de Honduras y el armado del CSV.
- Partir una entrega en más PR si conviene.
