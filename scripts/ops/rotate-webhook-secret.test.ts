import assert from 'node:assert/strict'
import test from 'node:test'
import { rotateWebhookSecret } from './rotate-webhook-secret.ts'

test('rotateWebhookSecret llama el RPC y no imprime el secreto', async () => {
  const calls: { url: string; body: string }[] = []
  const logs: string[] = []
  const orig = console.log
  console.log = (...a: unknown[]) => {
    logs.push(a.map(String).join(' '))
  }
  try {
    const out = await rotateWebhookSecret({
      url: 'https://example.supabase.co',
      serviceRole: 'service-role-key',
      tenantId: '11111111-1111-1111-1111-111111111111',
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), body: String(init?.body ?? '') })
        return new Response(
          JSON.stringify({ secret: 'plain-super-secret-value', last4: 'cret' }),
          { status: 200 },
        )
      },
    })
    assert.equal(out.last4, 'cret')
    assert.match(calls[0].url, /admin_webhook_rotar_secret/)
    const dumped = `${logs.join('\n')}\n${JSON.stringify(out)}`
    assert.equal(dumped.includes('plain-super-secret-value'), false)
  } finally {
    console.log = orig
  }
})
