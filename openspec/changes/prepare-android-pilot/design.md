# Diseño — decisiones del piloto

## Local + producción
Se adopta la decisión del usuario. Staging remoto queda optativo, porque
eliminar sus scripts borraría una capacidad útil; apuntarlos a producción
mezclaría datos sintéticos con operación real. Los tests CI con fixtures usan
una URL loopback y no requieren credenciales de producción.

Las comprobaciones de URL se copian en web y backoffice como sus helpers
actuales; no se introduce un paquete compartido. Móvil valida desde su punto de
entrada requireMobileEnv. Las direcciones privadas son necesarias para teléfonos
conectados a la LAN; el modo production las rechaza.

## APK preview con backend productivo
Preview nombra el formato de distribución, no un backend separado. Ambos
artefactos del piloto remoto usan el entorno EAS production y requieren sus
variables/configuración. Los testers operarán con cuentas y tenant de piloto
identificados; esta entrega no los crea.

## Modernización Android separada
Se mantiene Expo 51 en la primera entrega para que el arreglo de ambientes sea
revisable y verificable sin mezclar cambios de React Native. El siguiente cambio
debe seguir la migración incremental de Expo, elegir versiones de su matriz
oficial, conservar Node/pnpm anclados y demostrar API objetivo y compatibilidad
de bibliotecas en el AAB. No basta modificar targetSdkVersion.

## Publicación y operación
No se elimina el gate productivo vigente ni se habilita un bypass por omitir
staging. Un cambio posterior debe sustituir evidencia de staging por pruebas
locales del SHA candidato, ensayo de restauración y smoke productivo controlado.
El fallo de Sentry y la recuperación real de backups siguen siendo pendientes
operativos, no quedan resueltos al omitir un job de staging.
