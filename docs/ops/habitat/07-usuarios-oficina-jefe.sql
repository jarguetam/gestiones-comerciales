-- Hábitat · Fase 0 · 0.6 — Oficina de cada usuario y jefe de los supervisores
-- El formulario del backoffice no asigna oficina (zona_id) ni jefe a los
-- supervisores. Este script lo completa según docs/ops/habitat/usuarios.md:
--   · 17 usuarios (5 supervisores + 12 asesores) → su oficina.
--   · 5 supervisores → jefe Luis Martínez (gerente).
--   · Comprueba que cada asesor tenga el supervisor que le toca.
-- Linton Mejía y Nelson Munguía (cobros) quedan fuera hasta que Luis decida.
-- Idempotente.

begin;

do $$
declare
  v_t uuid;
  v_luis uuid;
  n int;
  v_mal text;
begin
  select id into v_t from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras';
  if v_t is null then
    raise exception 'No existe la empresa Hábitat';
  end if;

  create temp table plan_usuarios (email text primary key, oficina text not null, supervisor text) on commit drop;
  insert into plan_usuarios (email, oficina, supervisor) values
    ('maricela.lendos@habitathn.org',     'SRC', null),
    ('luis.lopez@habitathn.org',          'SPS', null),
    ('amilcar.matamoros@habitathn.org',   'SIG', null),
    ('cesar.gonzales@habitathn.org',      'SCY', null),
    ('marlon.reyes@habitathn.org',        'AGU', null),
    ('pedro.alvarado@habitathn.org',      'SRC', 'maricela.lendos@habitathn.org'),
    ('jorge.miranda@habitathn.org',       'SRC', 'maricela.lendos@habitathn.org'),
    ('cinthia.lopez@habitathn.org',       'SPS', 'luis.lopez@habitathn.org'),
    ('wilmer.osorio@habitathn.org',       'SPS', 'luis.lopez@habitathn.org'),
    ('edson.diaz@habitathn.org',          'SIG', 'amilcar.matamoros@habitathn.org'),
    ('winston.amaya@habitathn.org',       'SIG', 'amilcar.matamoros@habitathn.org'),
    ('kevin.amador@habitathn.org',        'TGU', 'amilcar.matamoros@habitathn.org'),
    ('alirio.anariba@habitathn.org',      'TGU', 'amilcar.matamoros@habitathn.org'),
    ('ernesto.mejia@habitathn.org',       'SCY', 'cesar.gonzales@habitathn.org'),
    ('florentino.castillo@habitathn.org', 'SCY', 'cesar.gonzales@habitathn.org'),
    ('edelia.hernandez@habitathn.org',    'AGU', 'marlon.reyes@habitathn.org'),
    ('gerson.argueta@habitathn.org',      'CEI', 'marlon.reyes@habitathn.org');

  -- 1. Oficina de cada uno
  update public.usuario u
     set zona_id = z.id
    from plan_usuarios p
    join auth.users au on lower(au.email) = p.email
    join public.zona z on z.tenant_id = v_t and z.codigo = p.oficina and z.activo
   where u.id = au.id and u.tenant_id = v_t;
  get diagnostics n = row_count;
  if n <> 17 then
    raise exception 'Se esperaban 17 usuarios con oficina y se actualizaron %: falta crear alguno o un correo no coincide', n;
  end if;

  -- 2. Jefe de los supervisores: Luis Martínez (gerente)
  select u.id into v_luis
    from public.usuario u join auth.users au on au.id = u.id
   where u.tenant_id = v_t and au.email = 'luis.martinez@habitathn.org' and u.rol = 'gerente' and u.activo;
  if v_luis is null then
    raise exception 'Luis Martínez no está como gerente activo';
  end if;

  update public.usuario u
     set jefe_id = v_luis
    from plan_usuarios p
    join auth.users au on lower(au.email) = p.email
   where u.id = au.id and u.tenant_id = v_t and p.supervisor is null and u.rol = 'supervisor';
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'Se esperaban 5 supervisores y se actualizaron %', n;
  end if;

  -- 3. Cada asesor con el supervisor que le toca (lo puso el formulario)
  select string_agg(p.email, ', ') into v_mal
    from plan_usuarios p
    join auth.users au on lower(au.email) = p.email
    join public.usuario u on u.id = au.id
    left join auth.users js on js.id = u.jefe_id
   where p.supervisor is not null
     and (u.rol <> 'asesor' or js.email is distinct from p.supervisor);
  if v_mal is not null then
    raise exception 'Asesores con rol o supervisor distinto al plan: %', v_mal;
  end if;

  perform public.registrar_auditoria(v_t, 'usuario', 'habitat-fase0', 'update',
    jsonb_build_object('script', 'docs/ops/habitat/07-usuarios-oficina-jefe.sql',
                       'con_oficina', 17, 'supervisores_con_jefe', 5));
end $$;

commit;
