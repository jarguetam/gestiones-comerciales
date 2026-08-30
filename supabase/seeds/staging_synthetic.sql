-- Seed sintético de staging. Nunca copiar PII de producción.
-- Usuarios Auth (asesor@staging.test / admin@staging.test) se crean por
-- scripts/ci/seed-e2e-user.ts; las contraseñas viven en GitHub Secrets.

insert into public.tenant (id, codigo, nombre, rubro, plan, branding, configuracion, activo)
values (
  '00000000-0000-4000-8000-000000000001',
  'acme-stg',
  'Acme Staging',
  'agro',
  'basico',
  '{"nombre_comercial":"Acme Staging"}'::jsonb,
  '{}'::jsonb,
  true
)
on conflict (id) do update
set nombre = excluded.nombre, activo = true;

insert into public.zona (tenant_id, codigo, nombre, activo)
values (
  '00000000-0000-4000-8000-000000000001',
  'Z-STG',
  'Zona Staging',
  true
)
on conflict (tenant_id, codigo) do nothing;

-- Placeholder de correos sintéticos (el perfil real lo ata seed-e2e-user).
-- asesor@staging.test  admin@staging.test
select 1;
