-- ============================================================
-- Seed — formularios dinámicos por rubro y config de rastreo base
-- Se instalan como plantilla al crear cada tenant (admin_tenant_crear).
-- Rubros: agro (microfinanzas agrícola), consumo, farmacéutico.
-- ============================================================

-- ---------- Plantilla AGRO: ficha de cultivo ----------
insert into public.formulario_plantilla (tenant_id, nombre, descripcion, esquema, calculo) values
  ('AGRO-tenant', 'Ficha de cultivo', 'Levantamiento en campo del estado del cultivo financiado',
   '{"campos":[
      {"clave":"cultivo","etiqueta":"Cultivo","tipo":"texto","requerido":true},
      {"clave":"hectareas","etiqueta":"Hectáreas sembradas","tipo":"numero","requerido":true,"min":0.1,"max":10000},
      {"clave":"estado_fenologico","etiqueta":"Estado fenológico","tipo":"seleccion","requerido":true,
       "opciones":["Germinación","Crecimiento","Floración","Llenado de grano","Madurez","Cosecha"]},
      {"clave":"plagas_observadas","etiqueta":"Plagas observadas","tipo":"texto","requerido":false},
      {"clave":"aplicaciones","etiqueta":"Aplicaciones aplicadas","tipo":"seleccion","requerido":false,
       "opciones":["Ninguna","Fungicida","Insecticida","Fertilizante","Mixta"]},
      {"clave":"rendimiento_estimado","etiqueta":"Rendimiento estimado (qq)","tipo":"numero","requerido":false,"min":0,"max":1000},
      {"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}
    ]}'::jsonb, 'porcentaje_completado'),
  ('AGRO-tenant', 'Verificación de garantías', 'Inspección prendaria de activos del crédito',
   '{"campos":[
      {"clave":"tipo_garantia","etiqueta":"Tipo de garantía","tipo":"seleccion","requerido":true,
       "opciones":["Maquinaria agrícola","Vehículo","Inventario","Inmueble","Prenda ganadera"]},
      {"clave":"estado_conservacion","etiqueta":"Estado de conservación","tipo":"seleccion","requerido":true,
       "opciones":["Excelente","Bueno","Regular","Deteriorado"]},
      {"clave":"valor_estimado","etiqueta":"Valor estimado (Q)","tipo":"numero","requerido":true,"min":0,"max":10000000},
      {"clave":"serie_motor","etiqueta":"Serie/motor","tipo":"texto","requerido":false},
      {"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}
    ]}'::jsonb, 'porcentaje_completado');

-- ---------- Plantilla CONSUMO: auditoría de punto de venta ----------
insert into public.formulario_plantilla (tenant_id, nombre, descripcion, esquema, calculo) values
  ('CONS-tenant', 'Auditoría de punto de venta', 'Revisión de exhibición y rotación de producto',
   '{"campos":[
      {"clave":"categoria_tienda","etiqueta":"Categoría de tienda","tipo":"seleccion","requerido":true,
       "opciones":["Tienda de barrio","Mini mercado","Distribuidora","Farmacia","Otro"]},
      {"clave":"exhibidores","etiqueta":"Exhibidores presentes","tipo":"numero","requerido":true,"min":0,"max":50},
      {"clave":"cumple_planograma","etiqueta":"Cumple planograma","tipo":"seleccion","requerido":true,"opciones":["Sí","No","Parcial"]},
      {"clave":"stock_quiebre","etiqueta":"Productos en quiebre","tipo":"numero","requerido":false,"min":0,"max":500},
      {"clave":"competencia_visible","etiqueta":"Competencia visible","tipo":"texto","requerido":false},
      {"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}
    ]}'::jsonb, 'porcentaje_completado');

-- ---------- Plantilla FARMACIA: detalle de visita médica ----------
insert into public.formulario_plantilla (tenant_id, nombre, descripcion, esquema, calculo) values
  ('FARM-tenant', 'Detalle de visita médica', 'Registro de interacción con profesional de salud',
   '{"campos":[
      {"clave":"profesional","etiqueta":"Profesional visitado","tipo":"texto","requerido":true},
      {"clave":"especialidad","etiqueta":"Especialidad","tipo":"texto","requerido":false},
      {"clave":"productos_presentados","etiqueta":"Productos presentados","tipo":"texto","requerido":true},
      {"clave":"nivel_interes","etiqueta":"Nivel de interés","tipo":"seleccion","requerido":true,
       "opciones":["Alto","Medio","Bajo","Ninguno"]},
      {"clave":"compromiso_receta","etiqueta":"Compromiso de receta","tipo":"seleccion","requerido":false,
       "opciones":["Inmediato","Corto plazo","En evaluación","No"]},
      {"clave":"muestras_entregadas","etiqueta":"Muestras entregadas","tipo":"numero","requerido":false,"min":0,"max":1000},
      {"clave":"observaciones","etiqueta":"Observaciones","tipo":"texto","requerido":false}
    ]}'::jsonb, 'porcentaje_completado');

-- ---------- Config de rastreo: semana laboral GT (lunes a sábado) ----------
-- Ventana 07:00–18:00, punto cada 15 min, precisión máxima aceptada 100 m.
insert into public.config_rastreo (tenant_id, dia_semana, hora_inicio, hora_fin, intervalo_min, precision_max_m)
select t.tenant_id, d.dia, '07:00', '18:00', 15, 100
from (values ('AGRO-tenant'), ('CONS-tenant'), ('FARM-tenant')) as t(tenant_id),
     (values (1),(2),(3),(4),(5),(6)) as d(dia);
