# SMTP (Auth, sin emailer)

v1 no incluye la función Edge `emailer`. Invitaciones y recupero de contraseña usan el mailer de **Supabase Auth**.

Variables exigidas por `scripts/ops/configure-supabase-project.ts` (`GC-OPS-008` si faltan):

- `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_ADMIN_EMAIL`

Verificación: `assertSmtpEnabled` sobre `GET /v1/projects/{ref}` / config Auth (`smtp.enabled`).

Staging y production deben tener SMTP. Sin él, recupero e invitaciones no salen.
