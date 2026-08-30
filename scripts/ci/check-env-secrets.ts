#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import {
  missingSecrets,
  parseGhSecretList,
  PRODUCTION_SECRETS,
  STAGING_SECRETS,
  type EnvironmentSecrets,
} from './required-secrets.ts'

function listSecrets(env: EnvironmentSecrets): string[] {
  const result = spawnSync('gh', ['secret', 'list', '--env', env], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || 'gh secret list falló').trim()
    throw new Error(`GC-OPS-008: no se pudieron listar secretos de ${env}: ${err}`)
  }
  return parseGhSecretList(result.stdout)
}

function main(argv = process.argv.slice(2), env = process.env) {
  const target = (argv[0] ?? env.CHECK_ENV ?? '') as EnvironmentSecrets
  if (target !== 'staging' && target !== 'production') {
    throw new Error('GC-OPS-008: uso: check-env-secrets.ts staging|production')
  }
  const required = target === 'staging' ? STAGING_SECRETS : PRODUCTION_SECRETS
  const present = listSecrets(target)
  const missing = missingSecrets(present, required)
  if (missing.length > 0) {
    throw new Error(`GC-OPS-008: faltan secretos en ${target}: ${missing.join(', ')}`)
  }
  console.log(`OK: ${target} tiene ${required.length} secretos requeridos`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

export { main }
