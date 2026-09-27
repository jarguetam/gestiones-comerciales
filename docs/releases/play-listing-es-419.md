# Ficha de Google Play — Gestiones Comerciales (borrador)

Texto para la primera entrega Android. La ficha no se ha cargado en Play Console.
La [guía de Google](https://support.google.com/googleplay/android-developer/answer/9859152?hl=es)
limita el nombre a 30 caracteres, la descripción breve a 80 y la completa a 4000.

## Nombre

Gestiones Comerciales

## Descripción breve

Agenda, visitas y formularios para equipos comerciales en campo.

## Descripción completa

Gestiones Comerciales ayuda a los asesores de empresas participantes a organizar
y registrar su trabajo en campo. Requiere una cuenta activa proporcionada por
tu empresa.

Consultá tu agenda y cartera asignada, registrá visitas y completá formularios
de campo. La app muestra el estado de sincronización de los registros capturados.
Algunas opciones dependen de los módulos habilitados por tu empresa.

Ubicación: para registrar el check-in de una visita, la app utiliza tu ubicación
mientras está abierta. Si tu empresa configura el rastreo de jornada, también
recopila tu ubicación durante el horario definido para registrar el recorrido
de campo, incluso en segundo plano cuando no usás la app. Los responsables
autorizados de tu empresa pueden consultar ese recorrido. La app muestra un
aviso antes de solicitar los permisos de ubicación del sistema.

## Datos de la ficha

- Categoría propuesta: Empresa.
- Precio propuesto: gratuita.
- Política de privacidad: <https://jarguetam.github.io/gestiones-comerciales/privacidad.html> (HTTP 200 verificado el 2026-09-26).
- Correo público de soporte: pendiente de definición del propietario.
- Ícono de Play: [borrador GC de 512 × 512 px](assets/play-icon-gc-draft.png),
  PNG de 32 bits con canal alfa y 6.8 KB. Coincide con el monograma del login,
  pero no se ha elegido ni sustituye el ícono del AAB actual.
- Gráfico de funciones: [borrador de 1024 × 500 px](assets/play-feature-graphic-draft.png),
  PNG RGB de 24 bits sin alfa. Usa el azul y las funciones reales del núcleo;
  revisar antes de cargarlo a Play. El ícono actual del binario es una cruz
  blanca sobre azul y aún requiere una decisión de marca.
- Capturas reales: pendientes; Play exige al menos dos y deben representar la
  versión instalada y sus funciones reales. Ver
  [requisitos de recursos](https://support.google.com/googleplay/android-developer/answer/9866151?hl=es).

## Declaraciones pendientes de Play Console

- Ubicación en segundo plano: declarar **rastreo del recorrido durante la jornada**
  como una función de la app. Aportar video Android que muestre el aviso, el
  permiso del sistema y el comportamiento con la app en segundo plano. Ver
  [requisitos de Google](https://support.google.com/googleplay/android-developer/answer/9799150?hl=es).
- Servicio en primer plano de ubicación: declarar su uso y aportar evidencia de
  activación y notificación. Ver
  [requisitos de Google](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en).
- Data safety: completar a partir del binario final, SDK de Sentry, Supabase,
  notificaciones y operaciones efectivas. El
  [borrador de auditoría](play-data-safety-audit.md) registra los datos observados
  y las dudas pendientes. No declarar que la app no recopila datos. Ver
  [guía de Google](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- Acceso del revisor: cuenta de prueba persistente del tenant piloto, con datos
  sintéticos y sin un TOTP que caduque. Cargar las credenciales únicamente en
  Play Console, nunca en Git. Ver
  [requisitos de acceso](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-GB).
- La cuenta personal requiere 12 testers inscritos continuamente durante al
  menos 14 días en prueba cerrada antes de solicitar acceso a producción.
