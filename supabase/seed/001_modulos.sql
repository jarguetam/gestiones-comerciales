-- ============================================================
-- Seed — catálogo de módulos (núcleo + optativos)
-- ============================================================
insert into public.modulo (codigo, nombre, nucleo) values
  ('core',       'Núcleo operativo',   true),
  ('crm',        'CRM y leads',        false),
  ('creditos',   'Créditos y cartera', false),
  ('solicitudes','Solicitudes y firma',false),
  ('depositos',  'Depósitos',          false),
  ('kilometraje','Kilometraje',        false)
on conflict (codigo) do nothing;
