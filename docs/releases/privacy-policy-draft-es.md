# Política de privacidad para Play — texto de trabajo

**No publicar todavía.** Faltan la identidad y el contacto del publicador,
la validación del borrado/retención en el Supabase productivo y la revisión de
los proveedores. El texto de abajo está preparado para sustituir la página
actual una vez confirmados esos puntos. Google exige que la política identifique
al desarrollador y un contacto, explique datos, terceros, seguridad, conservación
y eliminación, y coincida con la sección Seguridad de los datos de Play.
[Fuente](https://support.google.com/googleplay/android-developer/answer/10144311?hl=es).

## Texto propuesto

### Política de privacidad de Gestiones Comerciales

**Responsable y contacto.** Gestiones Comerciales es publicada por
`[NOMBRE DEL PUBLICADOR EN PLAY]`. Para consultas sobre privacidad o solicitudes
relativas a tus datos, escribí a `[CORREO DE PRIVACIDAD]`. Tu empresa administra
tu cuenta de trabajo y también puede atender solicitudes mediante su
administrador.

**Qué datos trata la app.** Para iniciar sesión, la app utiliza tu correo e
identificador de usuario. Según los módulos habilitados por tu empresa, trata
datos de cartera, clientes y prospectos, como nombres, teléfonos, documentos y
direcciones; registros de visitas, respuestas de formularios, solicitudes y
depósitos. Los registros pueden incluir comentarios, montos y referencias.
La app almacena temporalmente operaciones pendientes en el dispositivo para
sincronizarlas cuando hay conexión.

**Ubicación.** Para registrar un check-in o completar una visita, la app obtiene
tu ubicación precisa mientras la usás y envía las coordenadas al servicio de
tu empresa. Si tu empresa configura el rastreo de jornada, la app también
obtiene y envía ubicación precisa durante la ventana horaria configurada,
incluso cuando está en segundo plano. La finalidad es registrar el recorrido
de trabajo. La app muestra un aviso antes de pedir los permisos. Los usuarios
autorizados de tu empresa pueden consultar los registros de su tenant. El
administrador de la empresa configura o desactiva el rastreo de jornada.

**Notificaciones y diagnóstico.** Si autorizás las notificaciones, la app
obtiene un token del dispositivo y lo registra para enviarte avisos operativos.
La app envía a Sentry información técnica sobre fallos para detectar y resolver
problemas. El código desactiva el envío predeterminado de datos personales a
Sentry; el contenido efectivo de los eventos debe revisarse antes de publicar
esta afirmación.

**Proveedores y acceso.** La plataforma utiliza Supabase para autenticación,
base de datos y funciones del servicio; Google/Firebase para notificaciones
del dispositivo; y Sentry para diagnóstico de fallos. El acceso a los datos de
trabajo se limita por tenant y rol. No vendemos datos personales. Confirmar el
papel contractual de cada proveedor y si existen otras transferencias antes de
publicar esta sección.

**Seguridad.** Las comunicaciones de la app con los servicios configurados
usan HTTPS. La sesión se conserva en almacenamiento seguro del dispositivo y
el servidor aplica controles de acceso por tenant. Estos controles reducen el
riesgo de acceso no autorizado, pero no garantizan seguridad absoluta.

**Conservación y eliminación.** El código prevé purgar registros de recorrido
de más de 180 días. `[CONFIRMAR QUE EL JOB ESTÁ ACTIVO EN PRODUCCIÓN]`.
`[DEFINIR PLAZOS O CRITERIOS PARA CUENTAS, VISITAS, FORMULARIOS, CLIENTES,
AUDITORÍA Y DIAGNÓSTICOS]`. Para solicitar acceso, corrección o eliminación,
contactá a `[CORREO DE PRIVACIDAD]` o al administrador de tu empresa. Antes
de publicar, confirmar el procedimiento efectivo de eliminación y las
excepciones de conservación aplicables.

**Cuentas.** La app no permite crear una cuenta desde el dispositivo; las
cuentas son proporcionadas por la empresa participante. Para desactivar o
solicitar la eliminación de una cuenta, utilizá el contacto anterior.

**Cambios.** Si cambiamos el tratamiento de datos, actualizaremos esta política
y la ficha de Google Play. Fecha de vigencia: `[FECHA DE PUBLICACIÓN]`.

## Verificaciones previas a publicación

- Confirmar que `purgar-rastreo-180d` está programado y ejecutándose en
  producción. La migración captura errores de `cron.schedule` sin detenerse.
- Acordar identidad del publicador, correo y proceso de solicitudes, con la
  empresa responsable de cada tenant.
- Revisar el tratamiento real de Sentry, FCM y Supabase y su reflejo en
  Seguridad de los datos.
- Confirmar qué módulos opcionales estarán activos; no presentar como
  disponibles adjuntos, firma o fotos que el binario no guarda.
