-- Hábitat · Fase 0 · 0.4 — Oficinas y catálogos (roadmap §7, plan Task 11 Step 5)
-- Solo toca la empresa Hábitat. Requiere 01-geografia.sql.
-- Idempotente: reactiva lo que ya exista con el mismo nombre/código.
-- Los catálogos de relleno del asistente se DESACTIVAN, no se borran.
-- Santa Cruz → Santa Cruz de Yojoa y Aguán → Tocoa son supuestos: confirmar con Luis.

begin;

do $$
declare
  v_t uuid;
  n int;
begin
  select id into v_t from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras';
  if v_t is null then
    raise exception 'No existe la empresa Hábitat (codigo h-bitat-para-la-humanidad-honduras)';
  end if;

  -- 1. Oficinas (zonas) con su departamento y municipio
  insert into public.zona (tenant_id, codigo, nombre, departamento_id, municipio_id, activo)
  select v_t, z.codigo, z.nombre, d.id, m.id, true
    from (values
      ('SRC', 'Santa Rosa',     'Copán',             'Santa Rosa de Copán'),
      ('SPS', 'San Pedro Sula', 'Cortés',            'San Pedro Sula'),
      ('SIG', 'Siguatepeque',   'Comayagua',         'Siguatepeque'),
      ('TGU', 'Tegucigalpa',    'Francisco Morazán', 'Distrito Central'),
      ('SCY', 'Santa Cruz',     'Cortés',            'Santa Cruz de Yojoa'),
      ('AGU', 'Aguán',          'Colón',             'Tocoa'),
      ('CEI', 'La Ceiba',       'Atlántida',         'La Ceiba')
    ) as z(codigo, nombre, departamento, municipio)
    join public.departamento d on d.nombre = z.departamento
    join public.municipio m on m.departamento_id = d.id and m.nombre = z.municipio
  on conflict (tenant_id, codigo) do update
    set nombre = excluded.nombre,
        departamento_id = excluded.departamento_id,
        municipio_id = excluded.municipio_id,
        activo = true;
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'Se esperaban 7 oficinas y se cargaron %: falta geografía o un nombre no coincide', n;
  end if;

  -- 2. Actividades (5)
  insert into public.actividad (tenant_id, nombre, activo)
  select v_t, a.nombre, true
    from (values ('Cobros'), ('Administrativas'), ('Programas'), ('Desarrollo de recursos'), ('Negocios'))
      as a(nombre)
  on conflict (tenant_id, nombre) do update set activo = true;

  -- 3. Subactividades (30)
  insert into public.sub_actividad (tenant_id, actividad_id, nombre, activo)
  select v_t, a.id, s.nombre, true
    from (values
      ('Cobros', 'Pre cobro'),
      ('Cobros', 'Cobro 1–30 días'),
      ('Cobros', 'Cobro 31–60 días'),
      ('Cobros', 'Cobro 61–90 días'),
      ('Cobros', 'Cobro 91–120 días'),
      ('Cobros', 'Cobro más de 120 días'),
      ('Cobros', 'Visita con abogado'),
      ('Cobros', 'Campaña de recuperación'),
      ('Administrativas', 'Capacitación personal de Hábitat'),
      ('Administrativas', 'Dedicación de vivienda'),
      ('Administrativas', 'Devocional'),
      ('Administrativas', 'Vacaciones'),
      ('Administrativas', 'Permisos'),
      ('Administrativas', 'Incapacidad'),
      ('Programas', 'Capacitación beneficiarios subsidios'),
      ('Programas', 'Caracterización de familias'),
      ('Programas', 'Juntas con cooperantes'),
      ('Programas', 'Firma de acuerdos'),
      ('Desarrollo de recursos', 'Brigadas internacionales'),
      ('Desarrollo de recursos', 'Brigadas locales'),
      ('Desarrollo de recursos', 'Actividades de captación de recursos'),
      ('Desarrollo de recursos', 'Juntas con cooperantes'),
      ('Desarrollo de recursos', 'Firma de acuerdos'),
      ('Negocios', 'Promoción'),
      ('Negocios', 'Prospección'),
      ('Negocios', 'Documentación de prospectos'),
      ('Negocios', 'Análisis de prospectos'),
      ('Negocios', 'Comité de crédito'),
      ('Negocios', 'Capacitación de beneficiario'),
      ('Negocios', 'Investigación legal de terrenos')
    ) as s(actividad, nombre)
    join public.actividad a on a.tenant_id = v_t and a.nombre = s.actividad
  on conflict (tenant_id, actividad_id, nombre) do update set activo = true;
  get diagnostics n = row_count;
  if n <> 30 then
    raise exception 'Se esperaban 30 subactividades y se cargaron %', n;
  end if;

  -- 4. Bloques de horas (8). actividad_hora no tiene clave única: se evita el duplicado a mano.
  update public.actividad_hora h
     set cantidad = b.cantidad, activo = true
    from (values ('0–1 h', 1), ('1–2 h', 2), ('2–3 h', 3), ('3–4 h', 4),
                 ('4–5 h', 5), ('5–6 h', 6), ('6–7 h', 7), ('7–8 h', 8)) as b(nombre, cantidad)
   where h.tenant_id = v_t and h.nombre = b.nombre;
  insert into public.actividad_hora (tenant_id, nombre, cantidad, activo)
  select v_t, b.nombre, b.cantidad, true
    from (values ('0–1 h', 1), ('1–2 h', 2), ('2–3 h', 3), ('3–4 h', 4),
                 ('4–5 h', 5), ('5–6 h', 6), ('6–7 h', 7), ('7–8 h', 8)) as b(nombre, cantidad)
   where not exists (
     select 1 from public.actividad_hora h where h.tenant_id = v_t and h.nombre = b.nombre
   );

  -- 5. Desactivar los catálogos de relleno del asistente de alta
  update public.zona set activo = false
   where tenant_id = v_t and nombre = 'Zona 1';
  update public.sub_actividad s set activo = false
    from public.actividad a
   where a.id = s.actividad_id and a.tenant_id = v_t and a.nombre = 'Visita comercial';
  update public.actividad set activo = false
   where tenant_id = v_t and nombre = 'Visita comercial';
  update public.actividad_hora set activo = false
   where tenant_id = v_t and nombre in ('30 minutos', '1 hora', '2 horas');

  perform public.registrar_auditoria(v_t, 'catalogos', 'habitat-fase0', 'update',
    jsonb_build_object('script', 'docs/ops/habitat/02-catalogos.sql',
                       'zonas', 7, 'actividades', 5, 'subactividades', 30, 'horas', 8));
end $$;

commit;
