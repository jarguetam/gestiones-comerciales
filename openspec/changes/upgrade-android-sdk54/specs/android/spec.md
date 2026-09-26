# Compatibilidad Android

## Identidad
WHEN se resuelve la configuración de build
THEN conserva `com.gc.mobile` y el UUID Expo `f38df0fe-a2df-464e-95c0-98695be71198`.

## Distribución
WHEN se genera el AAB de publicación
THEN usa target SDK 36 o superior y las bibliotecas soportan páginas de 16 KB.

## Regresión
WHEN el usuario abre la app en Android con navegación por gestos o botones
THEN los controles quedan accesibles fuera de las barras del sistema.

WHEN se prueba la versión candidata
THEN login, permisos, cola persistente, sincronización y cierre de sesión se validan
en Android; Doctor y tests unitarios no sustituyen esa evidencia.
