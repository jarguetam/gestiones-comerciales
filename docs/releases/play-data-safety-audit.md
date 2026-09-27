# Datos y privacidad para Google Play — borrador de revisión

Basado en el código del candidato Android `1.0.0 (3)`; no es una declaración
enviada a Play Console. Según la [guía de Google](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en),
«recopilar» incluye los datos enviados fuera del dispositivo por la app o sus
SDK, y la respuesta debe abarcar todo el paquete publicado.

| Categoría a revisar en Play | Evidencia en la app | Finalidad observada |
|---|---|---|
| Correo y ID de usuario | `LoginScreen.tsx`, `lib/supabase.ts` y `lib/dispositivo.ts` | Autenticación, sesión y asociación del dispositivo. |
| Nombre, teléfono, documento, dirección y contenido escrito | `PersonaScreen.tsx`, `LeadsScreen.tsx`, `FormulariosScreen.tsx`, `lib/sync.ts` | Cartera, leads, visitas y formularios del tenant. Incluye datos de personas registradas por el asesor. |
| Ubicación precisa | `AgendaScreen.tsx`, `lib/sync.ts`, `services/rastreoServicio.ts` | Check-in/completar visita; recorrido de jornada si existe `config_rastreo`. El segundo caso continúa en segundo plano. |
| Identificador del dispositivo | `lib/push.ts`, `lib/dispositivo.ts` | Token FCM para notificaciones; se envía a Supabase tras autorizar notificaciones. |
| Diagnóstico y fallos | `lib/sentry.ts` | Sentry recibe eventos de error en producción. La configuración desactiva `sendDefaultPii`, pero hay que comprobar el contenido real de los eventos y el tratamiento del SDK antes de responder. |
| Información financiera de la operación | `DepositosScreen.tsx`, `SolicitudesScreen.tsx` | Monto y referencia de depósitos/solicitudes, solo si esos módulos están activos. Clasificación exacta de Play pendiente. |

La cámara/galería permite seleccionar una foto de boleta en `DepositosScreen.tsx`,
pero el flujo actual **no sube la imagen**: solo envía monto y referencia. No
declarar carga de fotos como funcionalidad disponible. `SolicitudesScreen.tsx`
muestra «Adjuntar archivo» y «Firme en el recuadro», pero inserta una ruta
ficticia y envía un PNG fijo de 1×1 a `pdf-solicitud`. Si el piloto activa
Solicitudes o Depósitos, corregir esas pantallas antes de ofrecerlas a testers.

La [política pública actual](https://jarguetam.github.io/gestiones-comerciales/privacidad.html)
describe ubicación y retención GPS, pero no identifica un contacto de privacidad
del publicador, ni explica con suficiente detalle los demás datos, proveedores,
seguridad y borrado. La [política de Google](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB)
exige que la información de Play, la política y el comportamiento de la app
coincidan. El [texto de trabajo](privacy-policy-draft-es.md) reúne lo comprobado
y marca las decisiones pendientes. Completar y publicar la política antes de
presentar la prueba cerrada.

Pendientes para cerrar la declaración:

1. Definir publicador, correo público y canal de solicitudes de privacidad.
2. Confirmar los módulos activos del tenant piloto y el comportamiento real de
   la base productiva, incluido el borrado de datos.
3. Revisar el tráfico real de Sentry/FCM y los términos de sus proveedores;
   decidir «compartido» frente a «proveedor de servicios» conforme a Google.
4. Completar en Play Console cada tipo de dato, finalidad, obligatoriedad,
   cifrado en tránsito y mecanismo de eliminación. No marcar «sin recopilación».
