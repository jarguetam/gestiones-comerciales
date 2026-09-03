# Rollback

Sin down-migrations. Secretos comprometidos se rotan; no se restauran valores viejos.

## Pages

Redeploy el SHA anterior: re-run de `pages-prod.yml` en el commit previo (artifact retenido 30 días) o `git revert` + push a `main`.

## Edge

`supabase functions deploy` desde el SHA anterior (`supabase-prod.yml` con ese SHA, o CLI local con el tree checkout).

## DB

**No** hay down-migration automática. Solo forward fixes. Si una migración expand rompe: no promover Pages; feature-flag / RPC que `returns null` (expand/contract). Corregir con una migración nueva.

## Android

Play Internal Testing: halt del release. Los testers siguen el APK preview del SHA anterior. No publicar en production track.

## Secret leak

1. Rotar con [secrets-rotation.md](secrets-rotation.md) (orden canónico; anon al final).
2. Invalidar sesiones: Admin API sobre `auth.users` (sign-out global / delete refresh).
3. Rebuild Pages y EAS con las keys nuevas.
