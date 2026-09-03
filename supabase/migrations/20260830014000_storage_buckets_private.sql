-- Gate 1 / Task 16 — buckets de producto privados.
update storage.buckets
   set public = false
 where id in ('firmas', 'documentos', 'importes');

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'firmas') then
    insert into storage.buckets (id, name, public) values ('firmas', 'firmas', false);
  end if;
  if not exists (select 1 from storage.buckets where id = 'documentos') then
    insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);
  end if;
  if not exists (select 1 from storage.buckets where id = 'importes') then
    insert into storage.buckets (id, name, public) values ('importes', 'importes', false);
  end if;
exception
  when undefined_table then
    raise notice 'storage.buckets no disponible en este entorno';
end $$;
