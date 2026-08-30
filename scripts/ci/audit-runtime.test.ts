import assert from 'node:assert/strict'
import test from 'node:test'
import { blockingRuntimeAdvisories, runtimePaths } from './audit-runtime.ts'

test('runtimePaths ignora el árbol de mobile', () => {
  assert.deepEqual(
    runtimePaths([
      'apps/mobile > expo@51 > @xmldom/xmldom@0.7.13',
      'apps/web > vite@6 > postcss@8.4.41',
    ]),
    ['apps/web > vite@6 > postcss@8.4.41'],
  )
})

test('blockingRuntimeAdvisories solo falla high/critical de web/backoffice', () => {
  const report = {
    advisories: {
      mobileOnly: {
        module_name: '@xmldom/xmldom',
        severity: 'high',
        findings: [{ paths: ['apps/mobile > expo@51 > @xmldom/xmldom@0.7.13'] }],
      },
      webHigh: {
        module_name: 'left-pad',
        severity: 'high',
        findings: [{ paths: ['apps/web > left-pad@1.0.0'] }],
      },
      webLow: {
        module_name: 'debug',
        severity: 'moderate',
        findings: [{ paths: ['apps/web > debug@4.0.0'] }],
      },
    },
  }
  assert.deepEqual(blockingRuntimeAdvisories(report), ['high left-pad: apps/web > left-pad@1.0.0'])
})
