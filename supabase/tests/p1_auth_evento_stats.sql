begin;
select plan(2);

insert into public.auth_evento (ip, email_hash, outcome, creado_en)
values ('203.0.113.9', 'hash-test', 'fail', now());

select ok(
  exists (
    select 1 from public.auth_evento_stats
     where ip = '203.0.113.9' and intentos >= 1
  ),
  'auth_evento_stats cuenta fallos recientes por IP'
);

select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');

select throws_ok(
  $$select * from public.auth_evento_stats$$,
  '42501',
  null,
  'authenticated no lee auth_evento_stats'
);

select * from finish();
rollback;
