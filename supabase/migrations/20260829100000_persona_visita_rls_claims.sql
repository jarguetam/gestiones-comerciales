-- ============================================================
-- Alta de persona/visita con claims en app_metadata (GoTrue).
-- Las políticas históricas leían auth.jwt() ->> 'tenant_id' en la raíz;
-- sin el hook custom_access_token el INSERT devolvía 42501 (RLS) y la
-- web tragaba el error como "No se pudo registrar el cliente".
-- tenant_id_actual()/rol_actual() ya miran app_metadata y public.usuario.
-- ============================================================

-- ---------- persona ----------
drop policy if exists tenant on public.persona;
drop policy if exists alcance_persona on public.persona;
drop policy if exists escritura_persona on public.persona;

-- Aislamiento de tenant: RESTRICTIVE (AND) para que el alcance por rol no se OR-ee.
create policy tenant on public.persona
  as restrictive
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

create policy alcance_persona on public.persona
  for select to authenticated
  using (
    public.rol_actual() = 'admin'
    or asesor_id = auth.uid()
    or asesor_id in (select public.subordinados())
  );

create policy escritura_persona on public.persona
  for all to authenticated
  using (
    public.rol_actual() = 'admin'
    or asesor_id = auth.uid()
    or asesor_id in (select public.subordinados())
  )
  with check (
    tenant_id = public.tenant_id_actual()
    and (
      public.rol_actual() = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select public.subordinados())
    )
  );

-- ---------- visita (mismo formulario W-03, mismo hueco de claims) ----------
drop policy if exists tenant on public.visita;
drop policy if exists alcance_visita on public.visita;
drop policy if exists escritura_visita on public.visita;
drop policy if exists actualizacion_visita on public.visita;

create policy tenant on public.visita
  as restrictive
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

create policy alcance_visita on public.visita
  for select to authenticated
  using (
    public.rol_actual() = 'admin'
    or usuario_id = auth.uid()
    or usuario_id in (select public.subordinados())
  );

create policy escritura_visita on public.visita
  for insert to authenticated
  with check (
    tenant_id = public.tenant_id_actual()
    and usuario_id = auth.uid()
  );

create policy actualizacion_visita on public.visita
  for update to authenticated
  using (
    usuario_id = auth.uid()
    or public.rol_actual() in ('supervisor', 'gerente', 'admin')
  )
  with check (tenant_id = public.tenant_id_actual());
