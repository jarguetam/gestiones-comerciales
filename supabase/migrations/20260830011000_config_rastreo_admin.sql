-- Gate 1 / Task 9 — config_rastreo: lectura tenant, escritura solo admin.

drop policy if exists tenant on public.config_rastreo;
drop policy if exists gestion_config_rastreo on public.config_rastreo;

create policy tenant on public.config_rastreo
  for select to authenticated
  using (tenant_id = public.tenant_id_actual());

create policy gestion_config_rastreo on public.config_rastreo
  for all to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.rol_actual() = 'admin'
  )
  with check (
    tenant_id = public.tenant_id_actual()
    and public.rol_actual() = 'admin'
  );
