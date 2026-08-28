-- ============================================================
-- Seed — formularios dinámicos por rubro (plantillas base P-05)
-- Viven en catalogo_plantilla. config_rastreo se instala al crear
-- cada tenant (aplicar_plantillas_rubro).
-- ============================================================
insert into public.catalogo_plantilla (rubro, tipo, nombre, payload) values
  ('agro', 'formulario', 'Ficha de cultivo',
    '{"descripcion":"Levantamiento en campo del estado del cultivo financiado","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"cultivo","etiqueta":"Cultivo","tipo":"texto","requerido":true},{"clave":"hectareas","etiqueta":"Hectáreas sembradas","tipo":"numero","requerido":true}]}}'::jsonb),
  ('agro', 'formulario', 'Verificación de garantías',
    '{"descripcion":"Inspección prendaria de activos del crédito","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"tipo_garantia","etiqueta":"Tipo de garantía","tipo":"seleccion","requerido":true,"opciones":["Maquinaria agrícola","Vehículo","Inventario"]}]}}'::jsonb),
  ('distribuidora', 'formulario', 'Auditoría de punto de venta',
    '{"descripcion":"Revisión de exhibición y rotación de producto","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"categoria_tienda","etiqueta":"Categoría de tienda","tipo":"seleccion","requerido":true,"opciones":["Tienda de barrio","Mini mercado"]}]}}'::jsonb),
  ('farmaceutica', 'formulario', 'Detalle de visita médica',
    '{"descripcion":"Registro de interacción con profesional de salud","calculo":"porcentaje_completado","esquema":{"campos":[{"clave":"profesional","etiqueta":"Profesional visitado","tipo":"texto","requerido":true}]}}'::jsonb)
on conflict (rubro, tipo, nombre) do nothing;
