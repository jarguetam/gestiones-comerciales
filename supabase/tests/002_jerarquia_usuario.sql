-- ============================================================
-- F1.5 — Tests de validar_jerarquia_usuario (trigger trg_usuario_jerarquia)
-- Reglas GC-CORE-010: cadena asesor→supervisor→gerente, admin sin jefe,
-- sin ciclos, asesor requiere supervisor, jefe activo.
-- ============================================================
begin;
select plan(7);

-- 1. asesor sin supervisor → rechazado
select throws_ok(
  $$insert into public.usuario (id, tenant_id, nombre, rol)
    values ('dddddddd-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111', 'Asesor huerfano', 'asesor')$$,
  'GC-CORE-010: todo asesor requiere supervisor'
);

-- 2. asesor con jefe gerente (salta nivel) → rechazado
select throws_ok(
  $$insert into public.usuario (id, tenant_id, nombre, rol, jefe_id)
    values ('dddddddd-0000-0000-0000-000000000002',
            '11111111-1111-1111-1111-111111111111', 'Asesor nivel roto', 'asesor',
            'aaaaaaaa-0000-0000-0000-000000000002')$$,
  'GC-CORE-010: jerarquía inválida (asesor→supervisor→gerente)'
);

-- 3. supervisor con jefe supervisor (mismo nivel) → rechazado
select throws_ok(
  $$insert into public.usuario (id, tenant_id, nombre, rol, jefe_id)
    values ('dddddddd-0000-0000-0000-000000000003',
            '11111111-1111-1111-1111-111111111111', 'Supervisor roto', 'supervisor',
            'aaaaaaaa-0000-0000-0000-000000000003')$$,
  'GC-CORE-010: jerarquía inválida (asesor→supervisor→gerente)'
);

-- 4. gerente con jefe → rechazado
select throws_ok(
  $$insert into public.usuario (id, tenant_id, nombre, rol, jefe_id)
    values ('dddddddd-0000-0000-0000-000000000004',
            '11111111-1111-1111-1111-111111111111', 'Gerente con jefe', 'gerente',
            'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'GC-CORE-010: jerarquía inválida (asesor→supervisor→gerente)'
);

-- 5. jefe inexistente o inactivo → rechazado
update public.usuario set activo = false where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select throws_ok(
  $$insert into public.usuario (id, tenant_id, nombre, rol, jefe_id)
    values ('dddddddd-0000-0000-0000-000000000005',
            '11111111-1111-1111-1111-111111111111', 'Asesor de inactivo', 'asesor',
            'aaaaaaaa-0000-0000-0000-000000000003')$$,
  'GC-CORE-010: jefe inexistente o inactivo'
);
update public.usuario set activo = true where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- 6. ciclo directo (jefe que es subordinado) → rechazado
select throws_ok(
  $$update public.usuario
    set jefe_id = 'aaaaaaaa-0000-0000-0000-000000000004'
    where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$,
  'GC-CORE-010: jerarquía inválida (asesor→supervisor→gerente)',
  'update que crearía ciclo es rechazado (además rompe la cadena de roles)'
);

-- 7. cadena válida → aceptado (asesor→supervisor existente y activo)
select lives_ok(
  $$insert into public.usuario (id, tenant_id, nombre, rol, jefe_id)
    values ('dddddddd-0000-0000-0000-000000000006',
            '11111111-1111-1111-1111-111111111111', 'Asesor válido', 'asesor',
            'aaaaaaaa-0000-0000-0000-000000000003')$$,
  'asesor→supervisor válido inserta sin error'
);

select * from finish();
rollback;
