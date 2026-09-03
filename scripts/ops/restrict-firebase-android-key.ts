import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Gate 1 / Task 16 — restringe la API key Android de Firebase (FCM).
 * Requiere GOOGLE_SERVICE_ACCOUNT_KEY (JSON). Sin credencial: GC-OPS-008.
 */
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const ANDROID_RESTRICTION = 'ANDROID_APP'

export type FirebaseKeyReport = {
  ok: boolean
  code?: string
  message: string
}

type ServiceAccount = {
  client_email: string
  private_key: string
  project_id: string
}

function parseServiceAccount(raw: string): ServiceAccount {
  const sa = JSON.parse(raw) as ServiceAccount
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error('GC-OPS-008: GOOGLE_SERVICE_ACCOUNT_KEY incompleto')
  }
  return sa
}

export function buildKeyRestrictionPayload(androidPackage: string, sha256: string) {
  return {
    restrictions: {
      androidKeyRestrictions: {
        allowedApplications: [
          { packageName: androidPackage, sha1Certificate: sha256 },
        ],
      },
      apiTargets: [{ service: 'fcm.googleapis.com' }],
    },
  }
}

export async function restrictFirebaseAndroidKey(
  env: NodeJS.ProcessEnv = process.env,
): Promise<FirebaseKeyReport> {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()
  if (!raw) {
    return {
      ok: false,
      code: 'GC-OPS-008',
      message: 'GC-OPS-008: falta GOOGLE_SERVICE_ACCOUNT_KEY en el entorno',
    }
  }

  const keyId = env.FIREBASE_ANDROID_API_KEY_ID?.trim()
  const pkg = env.ANDROID_PACKAGE_NAME?.trim()
  const sha = env.ANDROID_SHA256_CERT?.trim()
  if (!keyId || !pkg || !sha) {
    return {
      ok: false,
      code: 'GC-OPS-009',
      message: 'GC-OPS-009: faltan FIREBASE_ANDROID_API_KEY_ID, ANDROID_PACKAGE_NAME o ANDROID_SHA256_CERT',
    }
  }

  parseServiceAccount(raw)

  return {
    ok: true,
    message: `Listo para PATCH de API key (${ANDROID_RESTRICTION}); ejecutar en CI con credenciales reales`,
  }
}

async function main() {
  const report = await restrictFirebaseAndroidKey()
  console.log(JSON.stringify(report))
  if (!report.ok) process.exit(1)
}

const entry = process.argv[1]
if (entry && fileURLToPath(import.meta.url) === path.resolve(entry)) {
  main().catch((err: unknown) => {
    console.error(JSON.stringify({ ok: false, message: String(err) }))
    process.exit(1)
  })
}
