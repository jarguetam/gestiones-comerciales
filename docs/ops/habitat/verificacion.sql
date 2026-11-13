-- Hábitat · Fase 0 — Verificación (solo lectura). Una fila con un JSON.
-- Esperado tras 01–05 (plan Task 11): cada clave de "ok" en true.
-- Tras dar de alta a los usuarios, "sin_oficina" debe quedar vacío.

with t as (
  select id from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras'
),
hn as (
  select d.id from public.departamento d
   where d.nombre in ('Atlántida','Choluteca','Colón','Comayagua','Copán','Cortés','El Paraíso',
                      'Francisco Morazán','Gracias a Dios','Intibucá','Islas de la Bahía','La Paz',
                      'Lempira','Ocotepeque','Olancho','Santa Bárbara','Valle','Yoro')
),
v as (
  select
    (select count(*) from hn) as departamentos_hn,
    (select count(*) from public.municipio where departamento_id in (select id from hn)) as municipios_hn,
    (select count(*) from public.zona where tenant_id = (select id from t) and activo
        and municipio_id is not null and departamento_id is not null) as zonas_activas_con_municipio,
    (select count(*) from public.zona where tenant_id = (select id from t) and activo) as zonas_activas,
    (select count(*) from public.actividad where tenant_id = (select id from t) and activo) as actividades,
    (select count(*) from public.sub_actividad s join public.actividad a on a.id = s.actividad_id
      where s.tenant_id = (select id from t) and s.activo and a.activo) as subactividades,
    (select count(*) from public.actividad_hora where tenant_id = (select id from t) and activo) as horas,
    (select count(*) from public.zona where tenant_id = (select id from t) and activo and nombre = 'Zona 1')
      + (select count(*) from public.actividad where tenant_id = (select id from t) and activo and nombre = 'Visita comercial')
      + (select count(*) from public.actividad_hora where tenant_id = (select id from t) and activo
          and nombre in ('30 minutos','1 hora','2 horas')) as relleno_activo,
    (select count(*) from public.config_rastreo where tenant_id = (select id from t)) as rastreo_dias,
    (select count(*) from public.config_rastreo where tenant_id = (select id from t) and dia_semana = 0) as rastreo_domingo,
    (select coalesce(jsonb_agg(m.codigo order by m.codigo), '[]') from public.tenant_modulo tm
       join public.modulo m on m.id = tm.modulo_id
      where tm.tenant_id = (select id from t) and tm.activo) as modulos_activos,
    (select rol from public.usuario where tenant_id = (select id from t) and nombre = 'Luis Martinez') as rol_luis,
    (select count(*) from public.usuario where tenant_id = (select id from t) and rol = 'admin' and activo) as admins_activos,
    (select coalesce(jsonb_agg(nombre order by nombre), '[]') from public.usuario
      where tenant_id = (select id from t) and rol in ('asesor','supervisor') and zona_id is null) as sin_oficina
)
select jsonb_build_object(
  'datos', to_jsonb(v),
  'ok', jsonb_build_object(
    'geografia', v.departamentos_hn = 18 and v.municipios_hn = 298,
    'zonas', v.zonas_activas = 7 and v.zonas_activas_con_municipio = 7,
    'actividades', v.actividades = 5,
    'subactividades', v.subactividades = 30,
    'horas', v.horas = 8,
    'relleno_inactivo', v.relleno_activo = 0,
    'rastreo', v.rastreo_dias = 6 and v.rastreo_domingo = 0,
    'modulos', v.modulos_activos = '["core"]'::jsonb,
    'luis_gerente', v.rol_luis = 'gerente',
    'hay_admin', v.admins_activos >= 1,
    'usuarios_con_oficina', v.sin_oficina = '[]'::jsonb
  )
) as verificacion
from v;
