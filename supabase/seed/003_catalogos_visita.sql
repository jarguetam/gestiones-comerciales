-- ============================================================
-- Seed — catálogos de visita por rubro (actividad → sub_actividad, horas)
-- Se instalan como plantilla al crear cada tenant (admin_tenant_crear).
-- Rubros: agro (microfinanzas agrícola), consumo, farmacéutico.
-- ============================================================

-- Plantilla AGRO (AgroMoney): ciclo de crédito agrícola
insert into public.actividad (tenant_id, nombre) values
  ('AGRO-tenant', 'Verificación de garantías'),
  ('AGRO-tenant', 'Seguimiento de crédito'),
  ('AGRO-tenant', 'Prospección de cliente'),
  ('AGRO-tenant', 'Recuperación de cartera'),
  ('AGRO-tenant', 'Inspección de cultivo');

insert into public.sub_actividad (tenant_id, actividad_id, nombre)
select 'AGRO-tenant', a.id, sa.nombre
from public.actividad a
join (values
  ('Verificación de garantías', 'Inspección prendaria'),
  ('Verificación de garantías', 'Verificación de activos'),
  ('Verificación de garantías', 'Revisión de documentos'),
  ('Seguimiento de crédito', 'Revisión de estado de cuenta'),
  ('Seguimiento de crédito', 'Renegociación de cuota'),
  ('Seguimiento de crédito', 'Verificación de uso de fondos'),
  ('Prospección de cliente', 'Levantamiento de ficha'),
  ('Prospección de cliente', 'Presentación de producto'),
  ('Recuperación de cartera', 'Aviso de mora'),
  ('Recuperación de cartera', 'Acuerdo de pago'),
  ('Recuperación de cartera', 'Recuperación judicial'),
  ('Inspección de cultivo', 'Medición de hectáreas'),
  ('Inspección de cultivo', 'Estado fenológico')
) as sa(actividad, nombre) on sa.actividad = a.nombre;

-- Plantilla CONSUMO (Distribuidora GT): ventas y distribución
insert into public.actividad (tenant_id, nombre) values
  ('CONS-tenant', 'Toma de pedido'),
  ('CONS-tenant', 'Cobro de factura'),
  ('CONS-tenant', 'Merchandising'),
  ('CONS-tenant', 'Apertura de punto de venta');

insert into public.sub_actividad (tenant_id, actividad_id, nombre)
select 'CONS-tenant', a.id, sa.nombre
from public.actividad a
join (values
  ('Toma de pedido', 'Pedido programado'),
  ('Toma de pedido', 'Pedido de temporada'),
  ('Cobro de factura', 'Cobro a 30 días'),
  ('Cobro de factura', 'Cobro contado'),
  ('Merchandising', 'Montaje de exhibidor'),
  ('Merchandising', 'Rotación de inventario'),
  ('Apertura de punto de venta', 'Firma de contrato'),
  ('Apertura de punto de venta', 'Entrega de mobiliario')
) as sa(actividad, nombre) on sa.actividad = a.nombre;

-- Plantilla FARMACIA (Farmacéutica Central): visita médica
insert into public.actividad (tenant_id, nombre) values
  ('FARM-tenant', 'Visita médica'),
  ('FARM-tenant', 'Entrega de muestra'),
  ('FARM-tenant', 'Cierre de venta');

insert into public.sub_actividad (tenant_id, actividad_id, nombre)
select 'FARM-tenant', a.id, sa.nombre
from public.actividad a
join (values
  ('Visita médica', 'Presentación de producto'),
  ('Visita médica', 'Actualización de Guía Clínica'),
  ('Entrega de muestra', 'Muestra médica'),
  ('Entrega de muestra', 'Material informativo'),
  ('Cierre de venta', 'Pedido de farmacia'),
  ('Cierre de venta', 'Consignación')
) as sa(actividad, nombre) on sa.actividad = a.nombre;

-- Bloques de hora comunes (ex ActivitieHour)
insert into public.actividad_hora (tenant_id, nombre, cantidad) values
  ('AGRO-tenant', '30 minutos', 0.5),
  ('AGRO-tenant', '1 hora',     1.0),
  ('AGRO-tenant', '2 horas',    2.0),
  ('AGRO-tenant', '4 horas',    4.0),
  ('AGRO-tenant', 'Jornada completa', 8.0),
  ('CONS-tenant', '30 minutos', 0.5),
  ('CONS-tenant', '1 hora',     1.0),
  ('CONS-tenant', '2 horas',    2.0),
  ('CONS-tenant', '4 horas',    4.0),
  ('FARM-tenant', '30 minutos', 0.5),
  ('FARM-tenant', '1 hora',     1.0),
  ('FARM-tenant', '2 horas',    2.0);
