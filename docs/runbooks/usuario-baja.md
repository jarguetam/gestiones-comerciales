# Baja de usuario

1. Admin tenant: desactivar el usuario (`usuario_desactivar` / claims).
2. Invalidar sesión: Auth Admin `signOut` / ban.
3. Móvil: al próximo `onAuthStateChange` se limpia cola y FCM (Gate 4).
4. Tokens FCM del dispositivo: marcar inválidos.
5. No borrar auditoría. GPS se purga a los 180 días por job, no por baja.
