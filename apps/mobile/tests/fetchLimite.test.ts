import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { esErrorTransitorio } from '../src/lib/errorRed.ts'
import { fetchConLimite } from '../src/lib/fetchLimite.ts'

const colgado: typeof fetch = (_u, init) =>
  new Promise((_, rej) => {
    const abortar = () => rej(new DOMException('aborted', 'AbortError'))
    if (init?.signal?.aborted) abortar()
    else init?.signal?.addEventListener('abort', abortar)
  })

test('aborta una petición colgada con error transitorio', async () => {
  await assert.rejects(fetchConLimite(10, colgado)('https://x'), (e) => esErrorTransitorio(e))
})

test('respeta la señal del llamador', async () => {
  const ctl = new AbortController()
  const p = fetchConLimite(5_000, colgado)('https://x', { signal: ctl.signal })
  ctl.abort()
  await assert.rejects(p, (e) => esErrorTransitorio(e))
})

test('una señal ya abortada rechaza de inmediato', async () => {
  const ctl = new AbortController()
  ctl.abort()
  await assert.rejects(fetchConLimite(5_000, colgado)('https://x', { signal: ctl.signal }))
})

test('devuelve la respuesta y limpia el temporizador', async () => {
  const ok: typeof fetch = async () => new Response('ok')
  const r = await fetchConLimite(60_000, ok)('https://x')
  assert.equal(await r.text(), 'ok')
})
