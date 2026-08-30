-- Gate 1 / Task 16 — buckets de producto no públicos.
begin;
select plan(3);

select ok(
  not exists (
    select 1 from storage.buckets
     where id in ('firmas', 'documentos', 'importes')
       and public = true
  ),
  'buckets firmas/documentos/importes son privados'
);

select is(
  (select count(*)::int from storage.buckets where id in ('firmas', 'documentos', 'importes')),
  3,
  'existen los tres buckets de producto'
);

select ok(
  (select bool_and(public = false) from storage.buckets where id in ('firmas', 'documentos', 'importes')),
  'ningún bucket de producto es público'
);

select * from finish();
rollback;
