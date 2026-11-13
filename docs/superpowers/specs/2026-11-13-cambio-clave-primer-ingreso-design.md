# Cambio obligatorio de contraseña en el primer ingreso — diseño corto

Aprobado por Josue el 2026-11-13. Origen: alta de los 18 usuarios de Hábitat con
una contraseña temporal compartida; las claves no se entregan hasta que esto exista.

## Intención

Quien recibe una contraseña temporal tiene que cambiarla la primera vez que entra,
en la web (`apps/web`) o en la app (`apps/mobile`). Así la clave temporal deja de
servir apenas su dueño entra, y un compañero que conozca la clave común no puede
seguir usándola.

## Metas

- Todo usuario creado con `invitar-usuario` (backoffice de plataforma o web de la
  empresa) queda marcado: `app_metadata.debe_cambiar_clave = true`.
- La marca se borra sola en el servidor cuando cambia la contraseña, por cualquier
  vía: la pantalla nueva, Ajustes de la app o «¿Olvidaste tu contraseña?».
- Mientras la marca exista, la web y la app muestran solo la pantalla «Cambia tu
  contraseña»: nueva + confirmar, mínimo 8 caracteres, distinta de la temporal.
  Desde ahí solo se puede cambiarla o salir.
- App sin señal con la marca puesta: la pantalla avisa que necesita conexión y
  deja salir. No deja trabajar hasta cambiarla.
- Hábitat: después del despliegue, un script de operación marca a los 18 usuarios
  nuevos y a Luis Martínez (no a `admin2@gestionescomerciales.com`).

## No metas

- Bloquear la API o RLS a quien no haya cambiado la clave. El bloqueo es de
  pantallas; el riesgo que se cubre es la clave temporal compartida.
- Vencimiento periódico de contraseñas o reglas más estrictas que 8 caracteres.
- Usuarios de plataforma (backoffice): no se marcan.

## Anti-metas

- Que el usuario pueda quitarse la marca sin cambiar la contraseña.
- Que la app quede girando o atrapada sin poder salir.
- Que usuarios de otras empresas, ya existentes, vean la pantalla.

## Restricciones

- La marca vive en `auth.users.raw_app_meta_data` (el usuario no puede escribir
  `app_metadata`). Los triggers que ya escriben ahí (`sync_auth_user_claims`,
  `usuario_claims_refresh`, `usuario_desactivar_claims`) combinan con `||` y no
  deben borrarla.
- GoTrue responde a `updateUser` con el usuario en memoria: después del cambio el
  cliente refresca la sesión para ver la marca borrada. Hay que comprobar contra
  GoTrue real (Supabase local) que la marca no reaparece.
- Despliegue: migración → función `invitar-usuario` → web (Pages). La app lo
  incluye en el primer APK de Hábitat.
- Códigos de error `GC-*` nuevos van a `errors.json`; README cuenta migraciones.

## Enfoques

1. **Marca en `app_metadata` + trigger en `auth.users` que la borra al cambiar
   `encrypted_password` (elegido).** El usuario no puede tocarla; la web y la app
   ya leen `app_metadata` de la sesión, también sin señal; cubre cualquier vía de
   cambio.
2. Columna en `public.usuario` + RPC que la borra después del cambio. Descartado:
   el usuario podría llamar la RPC sin cambiar la clave, y la app necesitaría otra
   consulta y otro dato en su caché.
3. Función nativa de Supabase. No existe un «forzar cambio de contraseña».

## Lo que queda al constructor

- Nombres de componentes, textos exactos de la pantalla y su ubicación en cada app.
- Cómo la web y la app esperan la sesión refrescada antes de soltar la pantalla.
- Forma exacta del script de operación de Hábitat (`docs/ops/habitat/`).
