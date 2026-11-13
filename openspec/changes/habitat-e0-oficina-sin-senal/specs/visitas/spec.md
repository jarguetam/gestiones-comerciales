# Capability: visitas — Especificación de requisitos (delta)

## ADDED Requirements

### Requirement: Oficina y geografía resueltas en el servidor
`visita_crear` SHALL resolver la zona (oficina) en el orden `p_zona_id` explícito → zona del usuario → primera zona activa de la empresa por nombre, y el municipio en el orden `p_municipio_id` → municipio del cliente → municipio de la zona → primer municipio por `id`. El departamento SHALL ser `p_departamento_id` o el del municipio resuelto.

#### Scenario: Sin cliente y sin parámetros
- **WHEN** el asesor A (con oficina Z1, cuya geografía es Depto A / Muni A) crea una visita sin cliente y con oficina y geografía nulas
- **THEN** la visita queda con `zona_id` = Z1, `municipio_id` = Muni A y `departamento_id` = Depto A

#### Scenario: Geografía desde el cliente
- **WHEN** el asesor A crea una visita con `p_persona_id` de un cliente cuyo municipio es Muni B
- **THEN** la visita queda con `municipio_id` = Muni B, `departamento_id` = Depto B y `zona_id` = Z1

#### Scenario: El parámetro explícito gana
- **WHEN** el asesor A crea una visita con oficina y geografía explícitas (Muni A) y con un cliente de Muni B
- **THEN** la visita queda con `municipio_id` = Muni A

#### Scenario: Usuario sin oficina (regla de compatibilidad)
- **WHEN** el asesor B, sin zona asignada, crea una visita sin parámetros
- **THEN** la visita queda en la primera zona activa de la empresa y su `departamento_id` es el departamento de su `municipio_id`

#### Scenario: Empresa sin oficinas activas
- **WHEN** un asesor crea una visita en una empresa cuya única zona está desactivada
- **THEN** responde error `GC-VIS-002: la empresa no tiene oficinas activas`

### Requirement: Alta idempotente por clave de cliente
`visita_crear` SHALL aceptar `p_cliente_key uuid` opcional y, con él, SHALL ser idempotente; sin él, SHALL seguir funcionando para apps anteriores.

#### Scenario: Reintento con la misma clave
- **WHEN** el mismo usuario llama dos veces a `visita_crear` con la misma `p_cliente_key`
- **THEN** existe una sola visita con esa clave y la segunda llamada devuelve el mismo `id`

#### Scenario: Clave de otro usuario
- **WHEN** otro usuario llama a `visita_crear` con una `p_cliente_key` ya usada
- **THEN** responde error `GC-VIS-007: clave de cliente en uso`

### Requirement: La cola no gasta intentos sin señal
La cola local SHALL distinguir errores transitorios (red, tiempo agotado, sesión expirada `PGRST301`/«JWT expired») de errores del servidor. Los transitorios NO SHALL consumir intentos; los del servidor SÍ.

#### Scenario: Clasificación de errores
- **WHEN** se evalúa `esErrorTransitorio` sobre «Network request failed», `TypeError('Failed to fetch')`, «fetch failed» y `{code:'PGRST301', message:'JWT expired'}`
- **THEN** devuelve `true`; y devuelve `false` para `{code:'P0001', message:'GC-VIS-002…'}` y `{code:'23505'}`

#### Scenario: Envío sin señal
- **WHEN** `procesarCola` envía un ítem y el cliente lanza un error de red
- **THEN** el ítem queda `pendiente`, con `intentos` = 0, `ultimoError` = `GC-NET-001: sin conexión` y `proximoIntentoEn` = ahora + 15 000 ms

#### Scenario: Error del servidor
- **WHEN** el envío lanza un error del servidor (por ejemplo `P0001`)
- **THEN** el ítem queda en `error` con `intentos` incrementado en 1

#### Scenario: Petición colgada por señal débil
- **WHEN** una petición no responde dentro del límite de `fetchConLimite`
- **THEN** se aborta con un error que `esErrorTransitorio` reconoce y la cola no queda bloqueada

### Requirement: Reactivar ítems agotados
El usuario SHALL poder reactivar un ítem agotado desde la pantalla Sincronización, y la reactivación SHALL alcanzar a sus ítems dependientes.

#### Scenario: Reactivar un ítem agotado
- **WHEN** se reactiva un ítem con 5 intentos y estado `error`
- **THEN** pasa a `pendiente`, con `intentos` = 0, `proximoIntentoEn` = 0 y sin `ultimoError`

#### Scenario: Reactivar un alta reactiva su check-in y su cierre
- **WHEN** se reactiva un ítem `visita` con `clienteKey` u1 cuyo `visita_checkin` y `visita_completar` (con `visitaClienteKey` u1) murieron con `GC-SYNC-001`
- **THEN** los tres ítems quedan `pendiente`

#### Scenario: Reactivar deja el ítem listo para el próximo envío
- **WHEN** `reactivarItem` se llama con la clave de la sesión activa sobre un ítem agotado
- **THEN** `reintentables(leerCola(), ahora)` lo incluye

#### Scenario: Contar lo que falta enviar
- **WHEN** la cola tiene 1 ítem pendiente, 1 en error agotado y 1 enviado
- **THEN** `sinEnviar` devuelve 2

#### Scenario: Doble toque en «Guardar»
- **WHEN** se encola dos veces el mismo `clienteKey` `visita:u1`
- **THEN** la cola contiene un solo ítem

### Requirement: Caché de campo por sesión
La app SHALL guardar catálogos, agenda y perfil en una caché SQLite particionada por empresa y usuario, y SHALL usarla solo ante error de red indicando de cuándo es el dato.

#### Scenario: Guardar y leer con fecha
- **WHEN** se guarda `agenda` para la sesión `t1:u1` y luego se lee
- **THEN** devuelve los datos y su fecha de guardado

#### Scenario: Otra sesión no ve la caché
- **WHEN** la sesión `t1:u2` lee `agenda`
- **THEN** devuelve `null`

#### Scenario: JSON corrupto
- **WHEN** la fila de caché contiene JSON inválido
- **THEN** se trata como sin caché

#### Scenario: Limpiar una sesión
- **WHEN** se limpia la clave `t1:u1`
- **THEN** solo se borran las filas de esa sesión

### Requirement: Respaldo ante falta de red
Perfil y catálogos SHALL cargarse con respaldo: servidor si responde; caché si hay error de red; error propagado si el servidor rechaza.

#### Scenario: Servidor responde
- **WHEN** la carga tiene éxito
- **THEN** devuelve origen `servidor` y guarda en caché

#### Scenario: Error de red con caché
- **WHEN** la carga falla por red y existe caché
- **THEN** devuelve los datos con origen `cache` y su `guardadoEn`

#### Scenario: Error de red sin caché
- **WHEN** la carga falla por red y no hay caché
- **THEN** lanza `GC-NET-002: sin conexión y sin datos guardados`

#### Scenario: Error del servidor
- **WHEN** la carga falla con `{code:'42501'}`
- **THEN** se propaga ese mismo error y no se lee la caché

#### Scenario: Perfil sin señal conserva módulos
- **WHEN** la caché de perfil tiene `modulos: ['depositos']` y el cargador falla por red
- **THEN** el perfil devuelto incluye `depositos`

#### Scenario: Asesor con cartera grande
- **WHEN** se consulta el límite de clientes en campo
- **THEN** `LIMITE_PERSONAS_CAMPO` es al menos 1000 (valor 2000), de modo que un asesor con más de 200 clientes los tiene todos sin señal

#### Scenario: Oficina y geografía ya no las valida el cliente
- **WHEN** `validarVisitaNueva` recibe un borrador sin zona ni geografía
- **THEN** devuelve `null` (sin error), porque las resuelve el servidor

### Requirement: Cerrar sesión conserva lo no enviado
`logoutCleanup` NO SHALL borrar la cola local si hay registros sin enviar, y la app SHALL pedir confirmación antes de salir.

#### Scenario: Salir con pendientes
- **WHEN** el usuario sale con 2 registros sin enviar
- **THEN** no se llama a `clearCola`, sí se cierra la sesión y se limpia la caché de `t1:u1`, y devuelve `colaConservada: true`

#### Scenario: Salir sin pendientes
- **WHEN** el usuario sale sin registros pendientes
- **THEN** se limpian cola y caché de la sesión y devuelve `colaConservada: false`

### Requirement: Agenda local = servidor o caché + cola pendiente
La agenda mostrada SHALL resultar de la base (servidor o caché) combinada con todos los ítems de la cola, reconciliados por `cliente_key`; si la base ya refleja el efecto, manda la base.

#### Scenario: Visita creada sin señal
- **WHEN** la base está vacía y hay un ítem `visita` pendiente
- **THEN** aparece una visita `programada` con `id` nulo, `cliente_key` del ítem y `pendiente` = true

#### Scenario: El servidor ya la trae
- **WHEN** la base incluye la visita con ese `cliente_key`
- **THEN** no se duplica y `pendiente` no se marca

#### Scenario: Cierre pendiente
- **WHEN** hay un ítem `visita_completar` pendiente para una visita `programada`
- **THEN** se muestra `completada` con `pendiente` = true

#### Scenario: Check-in pendiente
- **WHEN** hay un ítem `visita_checkin` pendiente y la base no trae coordenadas
- **THEN** se muestran las coordenadas del payload

#### Scenario: Alta enviada que la base aún no trae
- **WHEN** el ítem `visita` está `enviado` y la base (más vieja) no lo trae
- **THEN** la visita sigue visible, sin marca de pendiente

#### Scenario: Cierre enviado con base vieja
- **WHEN** la base la trae `programada` y el ítem `visita_completar` está `enviado`
- **THEN** se muestra `completada`

#### Scenario: La base manda
- **WHEN** la base la trae `aprobada` y hay un ítem `visita_completar`
- **THEN** se muestra `aprobada`

#### Scenario: Otra fecha y orden
- **WHEN** hay ítems de otra fecha o varias visitas el mismo día
- **THEN** se ignoran los de otra fecha y el resultado se ordena por hora de inicio

#### Scenario: Rango de la agenda
- **WHEN** se llama `rangoAgenda('2026-11-30', 7)`
- **THEN** devuelve `{ desde: '2026-11-30', hasta: '2026-12-06' }`

### Requirement: El sincronizador crea con clave y resuelve visitas locales
`sync.ts` SHALL enviar `p_cliente_key` en el alta, con oficina y geografía nulas, y SHALL resolver el id de una visita local por `cliente_key` al hacer check-in o cierre, respetando el orden crear → check-in → cerrar.

#### Scenario: Alta con clave
- **WHEN** se sincroniza un ítem `visita` con `clienteKey` u1
- **THEN** `visita_crear` recibe `p_cliente_key: 'u1'` y `p_zona_id`, `p_departamento_id` y `p_municipio_id` nulos

#### Scenario: Check-in de visita local
- **WHEN** se sincroniza un `visita_checkin` con `visitaClienteKey` y el servidor ya tiene la visita (id 77)
- **THEN** `visita_checkin` se llama con `p_visita_id: 77`

#### Scenario: Visita local aún no creada
- **WHEN** se sincroniza un check-in cuya visita no existe en el servidor
- **THEN** lanza `GC-SYNC-001: la visita aún no llega al servidor`

#### Scenario: Ítems encolados por la versión anterior
- **WHEN** el payload trae `visitaId: 104` sin `visitaClienteKey`
- **THEN** se usa `p_visita_id: 104` sin consultar la tabla `visita`

### Requirement: La web delega oficina y geografía al servidor
La web SHALL crear visitas con el RPC `visita_crear`, enviando oficina y geografía nulas y una `p_cliente_key`.

#### Scenario: Argumentos del alta web
- **WHEN** `argsVisitaCrear` arma los argumentos de un evento
- **THEN** `p_zona_id`, `p_departamento_id` y `p_municipio_id` son `null` y `p_cliente_key` es la clave recibida

#### Scenario: Bloque de horas por defecto
- **WHEN** el evento no trae bloque de horas
- **THEN** se usa el bloque por defecto

#### Scenario: Cliente numérico o de demostración
- **WHEN** el id del cliente es `'12'` o `'vis-x'`
- **THEN** se convierte a 12 y a `null`, respectivamente

#### Scenario: Validaciones previas
- **WHEN** falta subactividad o bloque de horas
- **THEN** lanza `GC-VIS-001` o `GC-VIS-003`, respectivamente

### Requirement: Modo sin conexión con sesión vencida
Si al abrir la app llega `INITIAL_SESSION` sin sesión pero hay una sesión guardada cuyo token de acceso venció hace 7 días o menos, la app SHALL entrar en modo sin conexión con el usuario guardado, los claims decodificados localmente y el perfil en caché (o degradado), y SHALL mostrar el aviso «Modo sin conexión · tus registros se enviarán cuando vuelva la señal». NUNCA SHALL enviar el JWT vencido: las escrituras esperan (`GC-NET-004`) y las lecturas usan la caché. Cada 30 s y al volver la app a primer plano SHALL intentar `refreshSession({ refresh_token })`.

#### Scenario: Entrada en modo sin conexión
- **WHEN** llega `INITIAL_SESSION` sin sesión y la sesión guardada venció hace 2 días
- **THEN** la app entra en modo sin conexión con el usuario guardado, muestra el aviso y no va a Login

#### Scenario: Salida normal al volver la señal
- **WHEN** en modo sin conexión el `refreshSession` tiene éxito
- **THEN** la app pasa a modo normal, el aviso desaparece y la cola se envía con el nuevo token

#### Scenario: Sigue sin señal
- **WHEN** en modo sin conexión el `refreshSession` falla por red
- **THEN** la app permanece en modo sin conexión y reintenta en el siguiente ciclo

#### Scenario: Refresh rechazado por el servidor
- **WHEN** en modo sin conexión el servidor rechaza el `refresh_token`
- **THEN** la app registra `GC-AUTH-026`, va a Login y conserva la cola

#### Scenario: Más de 7 días
- **WHEN** el token de acceso guardado venció hace más de 7 días
- **THEN** la app va a Login y no entra en modo sin conexión

#### Scenario: Sesión guardada corrupta
- **WHEN** la sesión guardada no se puede interpretar
- **THEN** se registra `GC-AUTH-025` y la app va a Login

#### Scenario: Sin perfil en caché
- **WHEN** la app entra en modo sin conexión y no hay perfil en caché
- **THEN** usa un perfil degradado (decisión R4)

### Requirement: Cerrar sesión sin conexión borra la sesión guardada
El cierre de sesión SHALL borrar siempre las claves de sesión guardadas (`CLAVE_SESION`, `-user` y `-code-verifier`), aunque `signOut` falle sin red, y NO SHALL borrar los ítems sin enviar de la cola.

#### Scenario: signOut falla sin red
- **WHEN** el usuario sale sin señal y `signOut` falla
- **THEN** se registra `GC-AUTH-027`, se borran las tres claves y la app vuelve a Login con la cola intacta

#### Scenario: Falla el borrado de claves
- **WHEN** falla el borrado de una de las claves
- **THEN** se registra `GC-AUTH-028` y el cierre continúa

#### Scenario: Falla la desactivación del dispositivo
- **WHEN** la desactivación del dispositivo falla al salir
- **THEN** se registra la advertencia `GC-AUTH-029` y no se bloquea el regreso a Login

### Requirement: Perfil degradado en vez de bloquear el login
Un error no transitorio al leer el perfil NO SHALL bloquear el ingreso: la app SHALL continuar con un perfil degradado y registrar `GC-AUTH-023` (decisión R3). Sin señal y sin perfil en caché, SHALL usar también un perfil degradado (decisión R4).

#### Scenario: Error de lectura del perfil que no es de red
- **WHEN** la lectura del perfil falla con un error del servidor (no transitorio)
- **THEN** el usuario entra con perfil degradado y se registra `GC-AUTH-023`

### Requirement: La caché de clientes no guarda documento
La caché de campo SHALL guardar de cada cliente solo `id`, `nombre`, `direccion` y `categoria`, sin número de documento. La búsqueda sin señal SHALL ser por nombre o categoría; el servidor SHALL detectar el cliente duplicado por documento.

#### Scenario: Campos guardados
- **WHEN** se guarda la lista de clientes en la caché
- **THEN** cada registro contiene solo `id`, `nombre`, `direccion` y `categoria`

#### Scenario: Búsqueda sin señal
- **WHEN** se busca un cliente sin señal por nombre o categoría
- **THEN** se encuentra en la caché; la búsqueda por documento no está disponible

#### Scenario: Cliente duplicado
- **WHEN** se registra sin señal un cliente cuyo documento ya existe
- **THEN** el servidor lo detecta al sincronizar y rechaza el duplicado
