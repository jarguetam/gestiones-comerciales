# Dispositivo perdido

1. Usuario: cambiar contraseña (web o Ajustes).
2. Admin: desactivar el dispositivo en `dispositivo` y rotar FCM.
3. Auth: cerrar sesiones (`signOut` global).
4. La cola offline queda en el aparato; sin sesión no sincroniza. No hay wipe remoto en v1.
5. Si había rastreo activo, el admin puede apagar `config_rastreo` mientras se recupera el equipo.
