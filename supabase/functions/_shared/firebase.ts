/**
 * Cliente mínimo de FCM HTTP v1 para Edge Functions.
 *
 * google-services.json (apps/mobile) es la config de CLIENTE: sirve para que
 * la app reciba push, pero para ENVIAR desde el backend hace falta la cuenta
 * de servicio de Firebase (Console → Configuración → Cuentas de servicio).
 * Se configura como secret de Supabase, nunca en el repo:
 *
 *   supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
 *
 * Con el secret presente se envía vía FCM v1; sin él, push-notifications
 * degrada a notificación in-app (tabla `notificacion`).
 */

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function getServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa as ServiceAccount;
  } catch {
    return null;
  }
}

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
    ? input
    : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;
let cachedToken: { token: string; expira: number } | null = null;

async function importPrivateKey(sa: ServiceAccount): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

/** OAuth2 access token (JWT bearer) con scope firebase.messaging, cacheado ~50 min. */
export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expira > Date.now() + 60_000) return cachedToken.token;

  const ahora = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  }));

  const key = await importPrivateKey(sa);
  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claims}.${base64url(firma)}`,
  });
  if (!res.ok) throw new Error(`GC-PUSH-020: OAuth2 falló (${res.status})`);

  const data = await res.json();
  cachedToken = { token: data.access_token, expira: Date.now() + 50 * 60_000 };
  return cachedToken.token;
}

export interface FcmResult {
  ok: boolean;
  invalido: boolean; // token muerto → desactivar dispositivo
  detalle?: string;
}

/** Envía un mensaje FCM v1 a un token de dispositivo. */
export async function enviarFcm(
  sa: ServiceAccount,
  accessToken: string,
  tokenFcm: string,
  titulo: string,
  cuerpo: string,
  datos: Record<string, string>,
): Promise<FcmResult> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: tokenFcm,
          notification: { title: titulo, body: cuerpo },
          data: datos,
          android: { priority: "HIGH" },
        },
      }),
    },
  );

  if (res.ok) return { ok: true, invalido: false };

  const texto = await res.text();
  // UNREGISTERED / INVALID_ARGUMENT sobre el token → ya no sirve
  const invalido = res.status === 404 ||
    (res.status === 400 && texto.includes("INVALID_ARGUMENT"));
  return { ok: false, invalido, detalle: `${res.status}: ${texto.slice(0, 200)}` };
}
