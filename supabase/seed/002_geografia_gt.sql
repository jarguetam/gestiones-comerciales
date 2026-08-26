-- ============================================================
-- Seed — geografía base Guatemala (departamentos + municipios clave)
-- Extendible desde backoffice (P-05) o importador
-- ============================================================
insert into public.departamento (nombre) values
  ('Guatemala'), ('Alta Verapaz'), ('Baja Verapaz'), ('Chimaltenango'), ('Chiquimula'),
  ('El Progreso'), ('Escuintla'), ('Huehuetenango'), ('Izabal'), ('Jalapa'),
  ('Jutiapa'), ('Petén'), ('Quetzaltenango'), ('Quiché'), ('Retalhuleu'),
  ('Sacatepéquez'), ('San Marcos'), ('Santa Rosa'), ('Sololá'), ('Suchitepéquez'),
  ('Totonicapán'), ('Zacapa')
on conflict (nombre) do nothing;

-- municipios de referencia (el resto se importa por CSV desde el backoffice)
insert into public.municipio (departamento_id, nombre)
select d.id, m.nombre
from (values
  ('Guatemala', 'Guatemala'), ('Guatemala', 'Villa Nueva'), ('Guatemala', 'Mixco'),
  ('Guatemala', 'Chinautla'), ('Guatemala', 'San Miguel Petapa'),
  ('Sacatepéquez', 'Antigua Guatemala'), ('Escuintla', 'Escuintla'),
  ('Quetzaltenango', 'Quetzaltenango'), ('Alta Verapaz', 'Cobán'),
  ('Petén', 'Flores'), ('Huehuetenango', 'Huehuetenango'), ('Izabal', 'Puerto Barrios')
) as m(departamento, nombre)
join public.departamento d on d.nombre = m.departamento
on conflict do nothing;
