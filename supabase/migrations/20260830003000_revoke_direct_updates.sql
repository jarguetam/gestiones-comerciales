-- Gate 1 / Task 7 — las máquinas de estado solo transicionan por RPC.
--
-- RLS conserva tenant y alcance como segunda frontera. La primera frontera
-- es el privilegio de columna: sin UPDATE de tabla, una columna futura queda
-- denegada hasta que una migración la clasifique explícitamente.

-- El trigger histórico trg_visita_actualizado usa set_actualizado_en().
-- Completar la columna permite que las RPC SECURITY DEFINER de visita sigan
-- actualizando la fila al endurecer sus privilegios.
alter table public.visita
  add column if not exists actualizado_en timestamptz not null default now();

-- deposito_confirmar es el único dueño de estado y metadatos de confirmación.
revoke update on table public.deposito from public, anon, authenticated;
grant update (monto, referencia)
  on table public.deposito
  to authenticated;

-- solicitud_transicion es el único dueño de estado_id. El producto conserva
-- la edición directa de monto y descripción bajo actualizar_solicitud.
revoke update on table public.solicitud from public, anon, authenticated;
grant update (monto, descripcion)
  on table public.solicitud
  to authenticated;

-- lead_transicion, lead_convertir y lead_reasignar son dueños de estado,
-- conversión, pérdida y asignación. Los datos comerciales siguen editables.
revoke update on table public.lead from public, anon, authenticated;
grant update (
  origen_id,
  nombre,
  documento,
  telefono,
  email,
  municipio_id,
  direccion,
  coordenada,
  monto_estimado,
  detalles
)
  on table public.lead
  to authenticated;

-- Las RPC de visita son dueñas de estado, GPS, completado y revisión. La
-- agenda conserva edición directa de sus datos descriptivos bajo RLS.
revoke update on table public.visita from public, anon, authenticated;
grant update (
  persona_id,
  persona_nombre,
  direccion,
  comentario,
  departamento_id,
  municipio_id,
  zona_id,
  actividad_id,
  sub_actividad_id,
  actividad_hora_id,
  fecha_visita,
  hora_inicio
)
  on table public.visita
  to authenticated;

notify pgrst, 'reload schema';
