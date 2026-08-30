-- ============================================================
-- Gate 1 / Task 7 — estados mutables solo por RPC canónica.
-- Autónomo: crea y revierte sus propios fixtures.
-- ============================================================
begin;
select plan(27);

-- La frontera primaria es el privilegio de columna; futuras columnas no
-- heredan UPDATE porque authenticated no conserva el privilegio de tabla.
select is(
  (
    select bool_and(
      not has_table_privilege(
        'authenticated',
        format('public.%I', machine.table_name),
        'UPDATE'
      )
    )
      from (
        values ('deposito'), ('solicitud'), ('lead'), ('visita')
      ) as machine(table_name)
  ),
  true,
  'authenticated no tiene UPDATE amplio en ninguna máquina'
);

select is(
  (
    select bool_and(
      not has_column_privilege(
        'authenticated',
        format('public.%I', state_column.table_name),
        state_column.column_name,
        'UPDATE'
      )
    )
      from (
        values
          ('deposito', 'estado'),
          ('solicitud', 'estado_id'),
          ('lead', 'estado_id'),
          ('visita', 'estado')
      ) as state_column(table_name, column_name)
  ),
  true,
  'authenticated no puede actualizar las columnas de estado'
);

select is(
  (
    select bool_and(
      not has_column_privilege(
        'authenticated',
        format('public.%I', owned_column.table_name),
        owned_column.column_name,
        'UPDATE'
      )
    )
      from (
        values
          ('deposito', 'confirmado_por'),
          ('deposito', 'confirmado_en'),
          ('lead', 'perdido_motivo'),
          ('lead', 'persona_id'),
          ('lead', 'convertido_en'),
          ('lead', 'asesor_id'),
          ('visita', 'latitud'),
          ('visita', 'longitud'),
          ('visita', 'completada_en'),
          ('visita', 'revisada_por'),
          ('visita', 'revisada_en'),
          ('visita', 'comentario_rechazo')
      ) as owned_column(table_name, column_name)
  ),
  true,
  'los efectos laterales de transición también quedan bajo RPC'
);

select is(
  (
    select bool_and(
      has_column_privilege(
        'authenticated',
        format('public.%I', editable_column.table_name),
        editable_column.column_name,
        'UPDATE'
      )
    )
      from (
        values
          ('deposito', 'referencia'),
          ('solicitud', 'descripcion'),
          ('lead', 'nombre'),
          ('visita', 'comentario')
      ) as editable_column(table_name, column_name)
  ),
  true,
  'authenticated conserva UPDATE explícito en datos editables'
);

select is(
  (
    select bool_and(c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('deposito', 'solicitud', 'lead', 'visita')
  ),
  true,
  'RLS sigue activa como segunda frontera'
);

select is(
  (
    select bool_and(
      exists (
        select 1
          from pg_policy p
          join pg_class c on c.oid = p.polrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = machine.table_name
           and p.polcmd in ('w', '*')
      )
    )
      from (
        values ('deposito'), ('solicitud'), ('lead'), ('visita')
      ) as machine(table_name)
  ),
  true,
  'cada máquina conserva una policy RLS que cubre UPDATE'
);

select is(
  (
    select bool_and(p.prosecdef)
      from (
        values
          ('public.deposito_confirmar(bigint,text)'::regprocedure),
          ('public.solicitud_transicion(bigint,text,text)'::regprocedure),
          ('public.lead_transicion(bigint,text,text)'::regprocedure),
          ('public.visita_completar(bigint,text,numeric,numeric)'::regprocedure)
      ) as canonical(oid)
      join pg_proc p on p.oid = canonical.oid
  ),
  true,
  'las RPC canónicas siguen siendo SECURITY DEFINER'
);

-- Fixtures propios: Auth precede a los perfiles por FK.
insert into auth.users (id, email)
values
  ('77777777-0000-0000-0000-000000000002', 'supervisor@task7.test'),
  ('77777777-0000-0000-0000-000000000003', 'asesor@task7.test')
on conflict (id) do nothing;

insert into public.tenant (id, codigo, nombre, rubro, plan)
values (
  '77777777-0000-0000-0000-000000000001',
  'TASK7-STATE',
  'Tenant Task 7',
  'agro',
  'pro'
)
on conflict (id) do nothing;

insert into public.usuario (id, tenant_id, nombre, rol)
values (
  '77777777-0000-0000-0000-000000000002',
  '77777777-0000-0000-0000-000000000001',
  'Supervisor Task 7',
  'supervisor'
)
on conflict (id) do nothing;

insert into public.usuario (id, tenant_id, nombre, rol, jefe_id)
values (
  '77777777-0000-0000-0000-000000000003',
  '77777777-0000-0000-0000-000000000001',
  'Asesor Task 7',
  'asesor',
  '77777777-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

insert into public.modulo (codigo, nombre, nucleo)
values
  ('crm', 'CRM y leads', false),
  ('solicitudes', 'Solicitudes y firma', false),
  ('depositos', 'Depósitos', false)
on conflict (codigo) do nothing;

insert into public.tenant_modulo (tenant_id, modulo_id, activo)
select
  '77777777-0000-0000-0000-000000000001',
  m.id,
  true
from public.modulo m
where m.codigo in ('crm', 'solicitudes', 'depositos')
on conflict (tenant_id, modulo_id) do update set activo = true;

insert into public.departamento (nombre)
values ('Task 7 Departamento')
on conflict (nombre) do nothing;

insert into public.municipio (departamento_id, nombre)
select id, 'Task 7 Municipio'
from public.departamento
where nombre = 'Task 7 Departamento'
on conflict (departamento_id, nombre) do nothing;

insert into public.zona (tenant_id, codigo, nombre)
values (
  '77777777-0000-0000-0000-000000000001',
  'TASK7',
  'Zona Task 7'
)
on conflict (tenant_id, codigo) do nothing;

insert into public.actividad (tenant_id, nombre)
values (
  '77777777-0000-0000-0000-000000000001',
  'Actividad Task 7'
)
on conflict (tenant_id, nombre) do nothing;

insert into public.sub_actividad (tenant_id, actividad_id, nombre)
select
  '77777777-0000-0000-0000-000000000001',
  id,
  'Subactividad Task 7'
from public.actividad
where tenant_id = '77777777-0000-0000-0000-000000000001'
  and nombre = 'Actividad Task 7'
on conflict (tenant_id, actividad_id, nombre) do nothing;

insert into public.actividad_hora (tenant_id, nombre, cantidad)
values (
  '77777777-0000-0000-0000-000000000001',
  '1 hora Task 7',
  1
);

insert into public.persona (tenant_id, nombre, documento, asesor_id)
values (
  '77777777-0000-0000-0000-000000000001',
  'Persona Task 7',
  'TASK7-DOC',
  '77777777-0000-0000-0000-000000000003'
);

insert into public.solicitud_estado (tenant_id, codigo, nombre, orden)
values
  ('77777777-0000-0000-0000-000000000001', 'borrador', 'Borrador', 1),
  ('77777777-0000-0000-0000-000000000001', 'enviada', 'Enviada', 2)
on conflict (tenant_id, codigo) do update
set nombre = excluded.nombre,
    orden = excluded.orden;

insert into public.lead_estado (
  tenant_id,
  codigo,
  nombre,
  orden,
  es_ganado,
  es_perdido
)
values
  (
    '77777777-0000-0000-0000-000000000001',
    'nuevo',
    'Nuevo',
    1,
    false,
    false
  ),
  (
    '77777777-0000-0000-0000-000000000001',
    'contactado',
    'Contactado',
    2,
    false,
    false
  )
on conflict (tenant_id, codigo) do update
set nombre = excluded.nombre,
    orden = excluded.orden,
    es_ganado = excluded.es_ganado,
    es_perdido = excluded.es_perdido,
    activo = true;

insert into public.deposito (
  tenant_id,
  asesor_id,
  monto,
  referencia
)
values (
  '77777777-0000-0000-0000-000000000001',
  '77777777-0000-0000-0000-000000000003',
  700,
  'TASK7-REF'
);

insert into public.solicitud (
  tenant_id,
  persona_id,
  asesor_id,
  estado_id,
  monto,
  descripcion
)
select
  '77777777-0000-0000-0000-000000000001',
  p.id,
  '77777777-0000-0000-0000-000000000003',
  e.id,
  700,
  'Solicitud Task 7'
from public.persona p
join public.solicitud_estado e
  on e.tenant_id = p.tenant_id
 and e.codigo = 'borrador'
where p.documento = 'TASK7-DOC';

insert into public.lead (
  tenant_id,
  estado_id,
  nombre,
  telefono,
  asesor_id
)
select
  '77777777-0000-0000-0000-000000000001',
  e.id,
  'Lead Task 7',
  '+502 7777-0007',
  '77777777-0000-0000-0000-000000000003'
from public.lead_estado e
where e.tenant_id = '77777777-0000-0000-0000-000000000001'
  and e.codigo = 'nuevo';

insert into public.visita (
  tenant_id,
  usuario_id,
  persona_id,
  persona_nombre,
  comentario,
  departamento_id,
  municipio_id,
  zona_id,
  actividad_id,
  sub_actividad_id,
  actividad_hora_id,
  fecha_visita,
  hora_inicio,
  creado_por
)
select
  '77777777-0000-0000-0000-000000000001',
  '77777777-0000-0000-0000-000000000003',
  p.id,
  p.nombre,
  'Visita Task 7',
  d.id,
  m.id,
  z.id,
  a.id,
  sa.id,
  ah.id,
  current_date,
  '09:00',
  '77777777-0000-0000-0000-000000000003'
from public.persona p
cross join public.departamento d
join public.municipio m on m.departamento_id = d.id
cross join public.zona z
cross join public.actividad a
join public.sub_actividad sa on sa.actividad_id = a.id
cross join public.actividad_hora ah
where p.documento = 'TASK7-DOC'
  and d.nombre = 'Task 7 Departamento'
  and m.nombre = 'Task 7 Municipio'
  and z.tenant_id = '77777777-0000-0000-0000-000000000001'
  and z.codigo = 'TASK7'
  and a.tenant_id = '77777777-0000-0000-0000-000000000001'
  and a.nombre = 'Actividad Task 7'
  and sa.nombre = 'Subactividad Task 7'
  and ah.tenant_id = '77777777-0000-0000-0000-000000000001'
  and ah.nombre = '1 hora Task 7';

-- Supervisor: tiene alcance sobre el asesor de los tres primeros registros.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'tenant_id', '77777777-0000-0000-0000-000000000001',
    'rol', 'supervisor',
    'sub', '77777777-0000-0000-0000-000000000002'
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$update public.deposito
       set estado = 'confirmado'
     where referencia = 'TASK7-REF'$$,
  '42501',
  null,
  'UPDATE directo de deposito.estado falla'
);

select lives_ok(
  $$update public.deposito
       set referencia = 'TASK7-EDITADA'
     where referencia = 'TASK7-REF'$$,
  'deposito conserva edición no-estado permitida por RLS'
);

select is(
  (
    select referencia
      from public.deposito
     where referencia = 'TASK7-EDITADA'
  ),
  'TASK7-EDITADA',
  'la edición no-estado de depósito se persistió'
);

select lives_ok(
  $$select public.deposito_confirmar(
      (select id
         from public.deposito
        where referencia = 'TASK7-EDITADA'),
      'confirmado'
    )$$,
  'deposito_confirmar puede transicionar como SECURITY DEFINER'
);

select is(
  (
    select estado
      from public.deposito
     where referencia = 'TASK7-EDITADA'
  ),
  'confirmado',
  'deposito_confirmar cambió el estado'
);

select throws_ok(
  $$update public.solicitud
       set estado_id = (
         select id
           from public.solicitud_estado
          where tenant_id = '77777777-0000-0000-0000-000000000001'
            and codigo = 'enviada'
       )
     where descripcion = 'Solicitud Task 7'$$,
  '42501',
  null,
  'UPDATE directo de solicitud.estado_id falla'
);

select lives_ok(
  $$update public.solicitud
       set descripcion = 'Solicitud Task 7 editada'
     where descripcion = 'Solicitud Task 7'$$,
  'solicitud conserva edición de descripción'
);

select is(
  (
    select descripcion
      from public.solicitud
     where descripcion = 'Solicitud Task 7 editada'
  ),
  'Solicitud Task 7 editada',
  'la edición no-estado de solicitud se persistió'
);

select lives_ok(
  $$select public.solicitud_transicion(
      (select id
         from public.solicitud
        where descripcion = 'Solicitud Task 7 editada'),
      'enviada',
      'Task 7'
    )$$,
  'solicitud_transicion puede transicionar como SECURITY DEFINER'
);

select is(
  (
    select e.codigo
      from public.solicitud s
      join public.solicitud_estado e on e.id = s.estado_id
     where s.descripcion = 'Solicitud Task 7 editada'
  ),
  'enviada',
  'solicitud_transicion cambió el estado'
);

select throws_ok(
  $$update public.lead
       set estado_id = (
         select id
           from public.lead_estado
          where tenant_id = '77777777-0000-0000-0000-000000000001'
            and codigo = 'contactado'
       )
     where telefono = '+502 7777-0007'$$,
  '42501',
  null,
  'UPDATE directo de lead.estado_id falla'
);

select lives_ok(
  $$update public.lead
       set nombre = 'Lead Task 7 editado'
     where telefono = '+502 7777-0007'$$,
  'lead conserva edición de datos comerciales'
);

select is(
  (
    select nombre
      from public.lead
     where telefono = '+502 7777-0007'
  ),
  'Lead Task 7 editado',
  'la edición no-estado de lead se persistió'
);

select lives_ok(
  $$select public.lead_transicion(
      (select id
         from public.lead
        where telefono = '+502 7777-0007'),
      'contactado',
      null
    )$$,
  'lead_transicion puede transicionar como SECURITY DEFINER'
);

select is(
  (
    select e.codigo
      from public.lead l
      join public.lead_estado e on e.id = l.estado_id
     where l.telefono = '+502 7777-0007'
  ),
  'contactado',
  'lead_transicion cambió el estado'
);

-- La transición de visita exige al dueño.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'tenant_id', '77777777-0000-0000-0000-000000000001',
    'rol', 'asesor',
    'sub', '77777777-0000-0000-0000-000000000003'
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$update public.visita
       set estado = 'completada'
     where comentario = 'Visita Task 7'$$,
  '42501',
  null,
  'UPDATE directo de visita.estado falla'
);

select lives_ok(
  $$update public.visita
       set comentario = 'Visita Task 7 editada'
     where comentario = 'Visita Task 7'$$,
  'visita conserva edición de comentario'
);

select is(
  (
    select comentario
      from public.visita
     where comentario = 'Visita Task 7 editada'
  ),
  'Visita Task 7 editada',
  'la edición no-estado de visita se persistió'
);

select lives_ok(
  $$select public.visita_completar(
      (select id
         from public.visita
        where comentario = 'Visita Task 7 editada'),
      'Cierre canónico',
      14.6300000,
      -90.5100000
    )$$,
  'visita_completar puede transicionar como SECURITY DEFINER'
);

select is(
  (
    select estado
      from public.visita
     where comentario = 'Cierre canónico'
  ),
  'completada',
  'visita_completar cambió el estado'
);

reset role;
select set_config('request.jwt.claims', '', true);
select * from finish();
rollback;
