# Tasks — prepare-android-pilot

## 1. Configuración local / producción (esta entrega)
- [x] Regresión: móvil acepta Supabase local; los tres clientes rechazan cruces de entorno.
- [x] Implementar guardas GC-CORE-001 y ejemplos de localhost/emulador/LAN.
- [x] EAS: declarar entornos explícitos y etiquetar preview como producción.
- [x] Staging remoto optativo; mantener CI local y promoción productiva protegida.
- [x] Ejecutar unitarios, contratos, typecheck, builds y E2E de fixtures pertinentes.
- [x] Documentar resultados y limitaciones en `verification.md`; cambio separado del upgrade Android.

## 2. Compatibilidad Android (siguiente change)
- [ ] Verificar cuenta/proyecto EAS y paquete existente en Play antes de crear recursos.
- [ ] Proponer y ejecutar migración incremental Expo/RN; alinear Sentry y módulos nativos.
- [ ] Expo Doctor, typecheck, unitarios, bundle y build Android; API 36 y librerías de 16 KB verificadas.
- [ ] Probar permisos, notificaciones, recuperación y SQLite en dispositivo real.

## 3. Flujo de campo
- [ ] Levantar Supabase local; verificar migraciones/seeds y alta de empresa/usuarios con MFA.
- [ ] Validar agenda, personas y formulario; SQLite persistente tras matar/reabrir app.
- [ ] Sincronización idempotente y lectura web; probar aislamiento por usuario/tenant.
- [ ] Determinar empresa piloto; dejar solicitudes desactivado en ese tenant hasta corregir firma/adjuntos.

## 4. Operación y Play
- [ ] Sentry real y respaldo/restore de producción verificados; adaptar gate sin desactivar controles.
- [ ] Aviso de ubicación previo al permiso, política, Data safety, acceso del revisor y ficha de tienda.
- [ ] AAB firmado e instalación desde prueba interna; registrar build ID, SHA y resultados.
- [ ] Confirmar antigüedad de cuenta; ejecutar prueba cerrada 12 testers/14 días si aplica.
- [ ] Solicitar acceso y publicar solo con evidencia completa.
