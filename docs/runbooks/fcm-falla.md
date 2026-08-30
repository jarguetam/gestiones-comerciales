# FCM falla

Síntomas: Sentry/Edge `push-notifications` con `fcm_configurado: false` o tokens inválidos.

1. Confirmar `GOOGLE_SERVICE_ACCOUNT_KEY` / secret de Firebase en Edge.
2. `push-notifications` degrada a notificación in-app (`notificacion`).
3. Rotar tokens inválidos (logout limpia FCM en Gate 4).
4. Probe: un push de prueba a un dispositivo de staging.
5. Restricción de API key Android: Gate 1 / Gate 5.
