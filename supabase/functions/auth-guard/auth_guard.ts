export type RequestContext = { requestId: string };

export type AuthGuardLogEntry = {
  requestId: string;
  tenantId: string | null;
  userId: string | null;
  fn: "auth-guard";
  outcome: "ok" | "error";
  errorCode?: string;
};

export type AuthGuardDeps = {
  signIn: (input: { email: string; password: string }) => Promise<{
    session: { access_token: string; refresh_token: string } | null;
    error: unknown;
  }>;
  getAuthenticatorAssuranceLevel: () => Promise<{
    data: { currentLevel: string | null; nextLevel: string | null } | null;
    error: unknown;
  }>;
  countRecentFails: (ip: string, sinceIso: string) => Promise<number>;
  recordEvent: (input: {
    ip: string | null;
    emailHash: string;
    outcome: "ok" | "fail" | "blocked";
    requestId: string;
  }) => Promise<void>;
  log: (entry: AuthGuardLogEntry) => void;
  now?: () => number;
};

export class AuthGuardError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AuthGuardError";
  }
}

const WINDOW_MIN = 10;
const MAX_FAILS = 5;
const BLOCKED_MESSAGE = "GC-AUTH-040: demasiados intentos de inicio de sesión";

export function requestContext(req: Request): RequestContext {
  const supplied = req.headers.get("x-request-id");
  return {
    requestId: supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
      ? supplied
      : crypto.randomUUID(),
  };
}

export function parseClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp ? normalizeIp(realIp) : null;
}

function normalizeIp(value: string): string {
  if (value.startsWith("::ffff:")) return value.slice(7);
  return value;
}

export async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function corsHeadersForOrigin(
  req: Request,
  allowedOrigins: readonly string[],
): Record<string, string> | null {
  const origin = req.headers.get("origin");
  if (!origin) {
    return {
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-request-id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  if (!allowedOrigins.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function resolveAllowedOrigins(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return [];
  return envValue.split(",").map((part) => part.trim()).filter(Boolean);
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export async function handleAuthGuard(
  deps: AuthGuardDeps,
  req: Request,
  allowedOrigins: readonly string[],
): Promise<Response> {
  if (req.method === "OPTIONS") {
    if (allowedOrigins.length === 0) {
      return json(
        { error: "GC-CORE-001: configuración CORS incompleta" },
        500,
        { "Content-Type": "application/json" },
      );
    }
    const cors = corsHeadersForOrigin(req, allowedOrigins);
    if (!cors) {
      return json(
        { error: "GC-CORE-001: origen no permitido" },
        403,
        { "Content-Type": "application/json" },
      );
    }
    return new Response("ok", { headers: cors });
  }

  const cors = corsHeadersForOrigin(req, allowedOrigins);
  if (!cors) {
    return json(
      { error: "GC-CORE-001: origen no permitido" },
      403,
      { "Content-Type": "application/json" },
    );
  }

  if (req.method !== "POST") {
    return json({ error: "GC-AUTH-010: método no permitido" }, 405, cors);
  }

  const { requestId } = requestContext(req);
  const now = deps.now?.() ?? Date.now();
  const ip = parseClientIp(req);

  let email = "";
  let password = "";
  try {
    const body = await req.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || !body.email.trim()) {
      return json({ error: "GC-AUTH-011: email requerido" }, 400, cors);
    }
    if (typeof body.password !== "string" || !body.password) {
      return json({ error: "GC-AUTH-013: payload inválido" }, 400, cors);
    }
    email = body.email.trim();
    password = body.password;
  } catch {
    return json({ error: "GC-AUTH-013: payload inválido" }, 400, cors);
  }

  const emailHash = await hashEmail(email);

  if (ip) {
    const desde = new Date(now - WINDOW_MIN * 60_000).toISOString();
    const fails = await deps.countRecentFails(ip, desde);
    if (fails >= MAX_FAILS) {
      await deps.recordEvent({ ip, emailHash, outcome: "blocked", requestId });
      deps.log({
        requestId,
        tenantId: null,
        userId: null,
        fn: "auth-guard",
        outcome: "error",
        errorCode: "GC-AUTH-040",
      });
      return json({ error: BLOCKED_MESSAGE }, 429, cors);
    }
  }

  const { session, error } = await deps.signIn({ email, password });
  if (error || !session) {
    await deps.recordEvent({ ip, emailHash, outcome: "fail", requestId });
    deps.log({
      requestId,
      tenantId: null,
      userId: null,
      fn: "auth-guard",
      outcome: "error",
      errorCode: "GC-AUTH-001",
    });
    return json({ error: "GC-AUTH-001: credenciales inválidas" }, 401, cors);
  }

  await deps.recordEvent({ ip, emailHash, outcome: "ok", requestId });

  const { data: aal, error: aalError } = await deps.getAuthenticatorAssuranceLevel();
  if (aalError) {
    deps.log({
      requestId,
      tenantId: null,
      userId: null,
      fn: "auth-guard",
      outcome: "error",
      errorCode: "GC-AUTH-012",
    });
    return json({ error: "GC-AUTH-012: no se pudo evaluar MFA" }, 500, cors);
  }

  const requiresMfa = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";
  deps.log({
    requestId,
    tenantId: null,
    userId: null,
    fn: "auth-guard",
    outcome: "ok",
  });

  return json(
    {
      session,
      requires_mfa: requiresMfa,
    },
    200,
    cors,
  );
}
