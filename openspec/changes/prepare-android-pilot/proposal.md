# Proposal — prepare-android-pilot

## Problema
La app de campo tiene funciones implementadas, pero no una publicación Android
validada. El móvil rechaza Supabase local y el perfil EAS `preview` llama
staging al mismo backend de producción. Los workflows presuponen un segundo
proyecto remoto que no forma parte del esquema operativo elegido.

## Decisiones aprobadas
El 2026-09-20 el usuario indicó que el ambiente remoto actual será producción
y desarrollo será local. Aprobó avanzar con el piloto Android del núcleo de
campo, sin esperar a completar todos los módulos de web y backoffice.

## Cambio propuesto
1. Separar desarrollo local de producción en los tres clientes. Permitir
   Supabase local en Android y rechazar un backend público en modo local.
2. Identificar el APK de piloto y el AAB como clientes de producción. EAS debe
   elegir explícitamente el entorno de variables; no almacenar claves en Git.
3. Hacer optativos los jobs del staging remoto mediante `ENABLE_STAGING=true`.
   No reasignar sus seeds ni sus backups a producción.
4. Validar el recorrido empresa/usuarios → agenda → visita/formulario offline
   → sincronización → revisión web.
5. Migrar Expo en un cambio separado hasta una combinación compatible con API 36,
   comprobar bibliotecas nativas de 16 KB, permisos y generar un AAB firmado.
6. Prueba interna, prueba cerrada si aplica a la cuenta personal, y solicitud
   de acceso a producción en Play Console.

## Impacto
Primera entrega: validación de configuración pública, ejemplos locales,
perfiles EAS, condiciones de jobs existentes y documentación. Sin migraciones,
sin cambios de permisos RLS, sin escrituras en el proyecto remoto.

La actualización de Expo y la corrección de flujos móviles requieren sus propios
cambios/PRs y pruebas de regresión. Esta entrega no declara la app publicable.

## Fuera de alcance
iOS, terminar módulos optativos, reparar solicitudes/firma, cambiar el paquete
`com.gc.mobile`, activar o desactivar módulos de empresas existentes, publicar
en el track público, crear un staging remoto o copiar datos reales a local.

## Preguntas de aclaración
| Pregunta | Default / efecto si no hay respuesta |
|---|---|
| ¿La cuenta personal se creó después del 13-11-2023? | Confirmado por el usuario: sí. Se requiere prueba cerrada 12 testers/14 días antes de solicitar acceso a producción. |
| ¿Existe proyecto Expo/EAS accesible? | Verificado y vinculado `jarguetams-team/gestiones-comerciales-3uncfxmscvb2on8csmb7`, UUID `f38df0fe-a2df-464e-95c0-98695be71198`. No crear otro proyecto. El build espera la compatibilidad Android y configuración operativa. |
| ¿Qué empresa será el piloto? | No crear ni modificar tenants remotos. Probar primero con datos sintéticos locales. |
| ¿Solicitudes es indispensable en el piloto? | Excluirlo del tenant piloto mediante módulos existentes; no ocultarlo globalmente a clientes actuales. |

## Done del piloto
AAB firmado y comprobado, instalación real desde Play, recorrido completo con
evidencia por versión/dispositivo, ubicación y privacidad revisadas, respaldo
recuperable y monitoreo funcionando. Un CI de fixtures verde no sustituye estos
criterios. Ver specs y tasks para distinguir código listo de validación pendiente.
