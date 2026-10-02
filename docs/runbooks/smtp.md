# SMTP (Auth, sin emailer)

v1 no incluye la función Edge `emailer`. Invitaciones y recupero de contraseña usan el mailer de **Supabase Auth**.

Variables exigidas por `scripts/ops/configure-supabase-project.ts` (`GC-OPS-008` si faltan):

- `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_ADMIN_EMAIL`

Desde GitHub: Actions → «Configurar Auth producción» (primero sin `apply`, luego con `apply`). Local: `CONFIGURE_TARGET=production PAGES_PROD_URL=… CONFIGURE_APPLY=1 node --experimental-strip-types scripts/ops/configure-supabase-project.ts` hace `PATCH /v1/projects/{ref}/config/auth` (SMTP, `site_url`, redirects `<Pages>/**` y `gc://recuperar`) y relee para verificar. Sin `CONFIGURE_APPLY=1` solo muestra el cambio, con la contraseña redactada.

Staging y production deben tener SMTP. Sin él, recupero e invitaciones no salen.
