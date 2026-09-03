# Rollback

## Pages

Redeploy el SHA anterior (re-run del workflow en el commit previo) o `git revert` + push a `main`.

## Migraciones

Solo expand/contract. No hay down. Si una migración falla a medias: no promover Pages. Corregir con una migración nueva.

## Edge

`supabase functions deploy <fn> --project-ref <ref>` del SHA anterior.

## Android

Play Internal Testing: halt del release / publicar el AAB previo.

## Secretos

Si se filtró un valor: [secrets-rotation.md](secrets-rotation.md) y invalidar sesiones Auth.
