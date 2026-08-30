# Production readiness runbook

## Gate 0 — Drift y preflight

Antes de mergear cualquier cambio de seguridad:

```bash
pnpm ops:preflight
```

- **GC-OPS-007**: migraciones locales ≠ remoto. Aplicar pendientes con `supabase db push` (requiere `SUPABASE_ACCESS_TOKEN` y proyecto linkeado).
- No mergear Gate 1 con preflight rojo.

Migraciones históricas pendientes en prod (al 2026-08-30):

- `20260829010000_rls_jwt_app_metadata.sql`
- `20260829100000_persona_visita_rls_claims.sql`

## Gate 1 — Seguridad (este PR)

### Checklist

| Área | Verificación |
|------|----------------|
| Invitaciones | Solo `usuario_plataforma.es_superadmin` + AAL2; rollback Auth en fallo |
| Importer | Autorización antes de Storage; allowlist GC-* |
| Webhook HMAC | Secreto en Vault; `hmac_eq` timing-safe; rotación UI last4 |
| `seed_solicitud_estados` | Revocado para authenticated |
| Máquinas de estado | Columnas `estado` bloqueadas; transiciones vía RPC |
| Login | `auth-guard` centralizado; `auth_evento` 5 fails/10 min → 429 `GC-AUTH-040` |
| `config_rastreo` | Escritura solo admin tenant |
| RLS helpers | `tenant_id_actual()` / `rol_actual()` en deposito, solicitud, storage |
| PDF / Push | Sin fallback service_role; push solo service_role |
| Plataforma | `require_plataforma_aal2()` en RPCs backoffice |
| Storage | Buckets `firmas`, `documentos`, `importes` privados |
| `verify_jwt` | Explícito en las 8 Edge Functions (`config.toml`) |
| Auth hook | `node --experimental-strip-types scripts/ops/check-auth-hook.ts` |

### Comandos locales

```bash
pnpm -r typecheck
pnpm -r test
deno test --allow-read supabase/functions/
node --experimental-strip-types --test scripts/ops/*.test.ts
# pgTAP (requiere Docker):
# supabase test db
```

### Scripts ops

| Script | Uso |
|--------|-----|
| `scripts/ops/check-auth-hook.ts` | Valida `custom_access_token` en Management API |
| `scripts/ops/rotate-all-webhook-secrets.ts` | Rotación masiva staging (service_role) |
| `scripts/ops/restrict-firebase-android-key.ts` | Restricción API key Android FCM |

### Edge Functions `verify_jwt`

| Función | `verify_jwt` |
|---------|--------------|
| auth-guard | false |
| webhook-tenant | false |
| notify-jobs | false |
| resto | true |

### Post-merge

- Rotar HMAC en staging con `rotate-all-webhook-secrets.ts`; entregar plaintext una vez al admin.
- Gate 3: MFA enroll UI backoffice.
- Gate 6: rotación prod.
