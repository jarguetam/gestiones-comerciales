import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractSecurityDefinerFunctions,
  parseAllowlist,
  unexpectedDefiners,
} from './scan-security-definer.ts'

test('extractSecurityDefinerFunctions ignora funciones sin DEFINER', () => {
  const sql = `
    create function public.foo() returns void language sql as $$ select 1 $$;
    create or replace function public.bar()
    returns uuid language sql stable security definer
    as $$ select gen_random_uuid() $$;
  `
  assert.deepEqual(extractSecurityDefinerFunctions(sql), ['public.bar'])
})

test('unexpectedDefiners falla si aparece una nueva', () => {
  assert.deepEqual(unexpectedDefiners(['public.bar', 'public.nuevo'], ['public.bar']), ['public.nuevo'])
})

test('parseAllowlist ignora comentarios', () => {
  assert.deepEqual(parseAllowlist('# x\npublic.bar\n'), ['public.bar'])
})
