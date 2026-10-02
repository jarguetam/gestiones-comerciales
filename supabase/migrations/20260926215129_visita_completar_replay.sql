create or replace function public.visita_completar(
  p_visita_id bigint,
  p_comentario text default null,
  p_latitud numeric(10,7) default null,
  p_longitud numeric(10,7) default null
)
returns public.visita
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visita;
begin
  select * into v from public.visita where id = p_visita_id for update;
  if not found then raise exception 'visita no encontrada'; end if;
  if v.usuario_id is distinct from auth.uid() then
    raise exception 'solo el dueño puede completar la visita';
  end if;

  -- El RPC puede haberse confirmado aunque el móvil perdiera la respuesta.
  if v.estado in ('completada', 'aprobada', 'rechazada')
     and v.completada_en is not null
     and v.comentario is not distinct from coalesce(nullif(p_comentario, ''), v.comentario)
     and v.latitud is not distinct from coalesce(p_latitud, v.latitud)
     and v.longitud is not distinct from coalesce(p_longitud, v.longitud) then
    return v;
  end if;
  if v.estado <> 'programada' then
    raise exception 'transición inválida desde estado %', v.estado;
  end if;

  update public.visita
  set estado = 'completada',
      comentario = coalesce(nullif(p_comentario, ''), comentario),
      latitud = coalesce(p_latitud, latitud),
      longitud = coalesce(p_longitud, longitud),
      completada_en = now()
  where id = v.id
  returning * into v;

  perform public.registrar_auditoria(
    v.tenant_id, 'visita', v.id::text, 'update',
    jsonb_build_object('estado', 'completada')
  );
  return v;
end;
$$;
