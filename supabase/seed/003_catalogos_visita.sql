-- ============================================================
-- Seed — catálogos de visita por rubro (plantillas base P-05)
-- Viven en catalogo_plantilla (sin tenant). Se copian al crear
-- cada empresa vía admin_tenant_crear → aplicar_plantillas_rubro.
-- ============================================================
insert into public.catalogo_plantilla (rubro, tipo, nombre, payload) values
  ('agro', 'actividad', 'Verificación de garantías',
    '{"sub_actividades":["Inspección prendaria","Verificación de activos","Revisión de documentos"]}'::jsonb),
  ('agro', 'actividad', 'Seguimiento de crédito',
    '{"sub_actividades":["Revisión de estado de cuenta","Renegociación de cuota","Verificación de uso de fondos"]}'::jsonb),
  ('agro', 'actividad', 'Prospección de cliente',
    '{"sub_actividades":["Levantamiento de ficha","Presentación de producto"]}'::jsonb),
  ('agro', 'actividad', 'Recuperación de cartera',
    '{"sub_actividades":["Aviso de mora","Acuerdo de pago","Recuperación judicial"]}'::jsonb),
  ('agro', 'actividad', 'Inspección de cultivo',
    '{"sub_actividades":["Medición de hectáreas","Estado fenológico"]}'::jsonb),
  ('distribuidora', 'actividad', 'Toma de pedido',
    '{"sub_actividades":["Pedido programado","Pedido de temporada"]}'::jsonb),
  ('distribuidora', 'actividad', 'Cobro de factura',
    '{"sub_actividades":["Cobro a 30 días","Cobro contado"]}'::jsonb),
  ('distribuidora', 'actividad', 'Merchandising',
    '{"sub_actividades":["Montaje de exhibidor","Rotación de inventario"]}'::jsonb),
  ('distribuidora', 'actividad', 'Apertura de punto de venta',
    '{"sub_actividades":["Firma de contrato","Entrega de mobiliario"]}'::jsonb),
  ('farmaceutica', 'actividad', 'Visita médica',
    '{"sub_actividades":["Presentación de producto","Actualización de Guía Clínica"]}'::jsonb),
  ('farmaceutica', 'actividad', 'Entrega de muestra',
    '{"sub_actividades":["Muestra médica","Material informativo"]}'::jsonb),
  ('farmaceutica', 'actividad', 'Cierre de venta',
    '{"sub_actividades":["Pedido de farmacia","Consignación"]}'::jsonb)
on conflict (rubro, tipo, nombre) do nothing;
