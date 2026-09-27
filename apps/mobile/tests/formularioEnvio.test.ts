import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { crearAltaFormulario } from '../src/lib/formularioEnvio.ts'
import { encolar } from '../src/lib/cola.ts'
import { ejecutarMutacion } from '../src/lib/sync.ts'

const UUID = '123e4567-e89b-42d3-a456-426614174000'

test('el formulario conserva un UUID al encolar y reintentar el RPC', async () => {
  const alta = crearAltaFormulario(7, { cultivo: 'Maíz' }, null, () => UUID)
  assert.equal(alta.clienteKey, UUID)
  const [item] = encolar([], alta)
  const llamadas: Array<Record<string, unknown>> = []
  const cliente = {
    rpc: async (_nombre: string, parametros: Record<string, unknown>) => {
      llamadas.push(parametros)
      return { error: null }
    },
  }
  const ejecutar = ejecutarMutacion(cliente as Parameters<typeof ejecutarMutacion>[0])
  await ejecutar(item)
  await ejecutar(item)
  assert.deepEqual(llamadas.map((p) => p.p_cliente_key), [UUID, UUID])
})

test('rechaza la antigua clave textual antes de guardar el formulario', () => {
  assert.throws(
    () => crearAltaFormulario(7, {}, null, () => 'formulario:7:123'),
    /GC-CORE-001/,
  )
})
