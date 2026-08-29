export type InviteActor = {
  userId: string;
  aal: string;
};

export type InviteActorAuth = {
  getUser: (jwt: string) => Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  getAuthenticatorAssuranceLevel: (jwt: string) => Promise<{
    data: { currentLevel: string | null } | null;
    error: unknown;
  }>;
};

export type InviteLogEntry = {
  request_id: string;
  outcome: "ok" | "error";
  stage:
    | "authorize"
    | "validate"
    | "create_user"
    | "invite_profile"
    | "complete";
  error_code?: string;
  rollback_outcome?: "ok" | "error";
  rollback_error_code?: string;
};

export type InviteDeps = {
  requireActor: (req: Request) => Promise<InviteActor>;
  isPlatformSuperadmin: (userId: string) => Promise<boolean>;
  createUser: (input: {
    email: string;
    password: string;
    metadata: Record<string, string>;
  }) => Promise<{ id: string }>;
  inviteProfile: (input: {
    authUserId: string;
    tenantId: string;
    email: string;
    rol: string;
    nombre: string;
    jefeId: string | null;
    zonaId: number | null;
  }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  log: (entry: InviteLogEntry) => void;
};

export class InviteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "InviteError";
  }
}

type InviteBody = {
  tenant_id?: unknown;
  email?: unknown;
  nombre?: unknown;
  rol?: unknown;
  password?: unknown;
  jefe_id?: unknown;
  zona_id?: unknown;
};

const ROLES = new Set(["admin", "gerente", "supervisor", "asesor"]);
const DEFAULT_ERROR_CODE = "GC-AUTH-012";
const DEFAULT_ERROR_MESSAGE = "GC-AUTH-012: no se pudo completar la invitación";
const CATALOGUED_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "GC-AUTH-001": "GC-AUTH-001: sin autorización",
  "GC-AUTH-002": "GC-AUTH-002: rol inválido",
  "GC-AUTH-003": "GC-AUTH-003: usuario de auth no existe",
  "GC-AUTH-010": "GC-AUTH-010: método no permitido",
  "GC-AUTH-011": "GC-AUTH-011: tenant_id y email requeridos",
  "GC-AUTH-012": DEFAULT_ERROR_MESSAGE,
  "GC-AUTH-013": "GC-AUTH-013: payload inválido",
  "GC-AUTH-014": "GC-AUTH-014: se requiere autenticación AAL2",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function generarPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }Aa1!`;
}

function requestId(req: Request): string {
  const supplied = req.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

function rawErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (
    error && typeof error === "object" && "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return null;
}

function extractedErrorCode(error: unknown): string | null {
  const match = rawErrorMessage(error)?.match(/\bGC-[A-Z]+-\d{3}\b/);
  return match?.[0] ?? null;
}

function errorMessage(error: unknown): string {
  if (error instanceof InviteError) return error.message;
  const code = extractedErrorCode(error);
  return code
    ? CATALOGUED_ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGE
    : DEFAULT_ERROR_MESSAGE;
}

function errorCode(error: unknown): string {
  const code = extractedErrorCode(error);
  return code && CATALOGUED_ERROR_MESSAGES[code] ? code : DEFAULT_ERROR_CODE;
}

function errorStatus(error: unknown): number {
  if (error instanceof InviteError) return error.status;
  const code = errorCode(error);
  if (code === "GC-AUTH-001" || code === "GC-AUTH-014") return 403;
  if (code === "GC-AUTH-010") return 405;
  if (
    code === "GC-AUTH-002" || code === "GC-AUTH-003" ||
    code === "GC-AUTH-011" || code === "GC-AUTH-013"
  ) {
    return 400;
  }
  return 500;
}

function safeLog(deps: InviteDeps, entry: InviteLogEntry): void {
  try {
    deps.log(entry);
  } catch {
    // El logging no debe alterar el resultado ni impedir el rollback.
  }
}

export async function requireActorFromBearer(
  req: Request,
  auth: InviteActorAuth,
): Promise<InviteActor> {
  const authorization = req.headers.get("Authorization");
  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) {
    throw new InviteError("GC-AUTH-001: sin autorización", 401);
  }

  const { data: userData, error: userError } = await auth.getUser(bearer);
  if (userError || !userData.user) {
    throw new InviteError("GC-AUTH-001: sin autorización", 401);
  }

  const { data: assurance, error: assuranceError } = await auth
    .getAuthenticatorAssuranceLevel(bearer);
  if (assuranceError || !assurance) {
    throw new InviteError(
      "GC-AUTH-012: no se pudo verificar el nivel de seguridad",
      500,
    );
  }

  return {
    userId: userData.user.id,
    aal: assurance.currentLevel ?? "aal1",
  };
}

async function parseBody(req: Request): Promise<InviteBody> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error();
    }
    return body as InviteBody;
  } catch {
    throw new InviteError("GC-AUTH-013: payload inválido", 400);
  }
}

export async function invitarUsuario(
  deps: InviteDeps,
  req: Request,
): Promise<Response> {
  const request_id = requestId(req);

  if (req.method !== "POST") {
    return json({ error: "GC-AUTH-010: método no permitido" }, 405);
  }

  try {
    const actor = await deps.requireActor(req);
    if (actor.aal !== "aal2") {
      throw new InviteError(
        "GC-AUTH-014: se requiere autenticación AAL2",
        403,
      );
    }
    if (!await deps.isPlatformSuperadmin(actor.userId)) {
      throw new InviteError(
        "GC-AUTH-001: requiere superadmin de plataforma",
        403,
      );
    }

    const body = await parseBody(req);
    const tenantId = typeof body.tenant_id === "string"
      ? body.tenant_id.trim()
      : "";
    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
    if (!tenantId || !email) {
      throw new InviteError(
        "GC-AUTH-011: tenant_id y email requeridos",
        400,
      );
    }

    const rol = typeof body.rol === "string" ? body.rol : "asesor";
    if (!ROLES.has(rol)) {
      throw new InviteError("GC-AUTH-002: rol inválido", 400);
    }

    const nombre = typeof body.nombre === "string" && body.nombre.trim()
      ? body.nombre.trim()
      : email;
    const suppliedPassword =
      typeof body.password === "string" && body.password.length >= 8
        ? body.password
        : null;
    const generado = suppliedPassword === null;
    const password = suppliedPassword ?? generarPassword();
    const jefeId = typeof body.jefe_id === "string" ? body.jefe_id : null;
    const zonaId = typeof body.zona_id === "number" ? body.zona_id : null;

    let created: { id: string };
    try {
      created = await deps.createUser({
        email,
        password,
        metadata: { nombre },
      });
    } catch (error) {
      safeLog(deps, {
        request_id,
        outcome: "error",
        stage: "create_user",
        error_code: errorCode(error),
      });
      return json({ error: errorMessage(error) }, errorStatus(error));
    }

    try {
      await deps.inviteProfile({
        authUserId: created.id,
        tenantId,
        email,
        rol,
        nombre,
        jefeId,
        zonaId,
      });
    } catch (profileError) {
      let rollbackError: unknown;
      try {
        await deps.deleteUser(created.id);
      } catch (error) {
        rollbackError = error;
      }

      safeLog(deps, {
        request_id,
        outcome: "error",
        stage: "invite_profile",
        error_code: errorCode(profileError),
        rollback_outcome: rollbackError ? "error" : "ok",
        ...(rollbackError
          ? { rollback_error_code: errorCode(rollbackError) }
          : {}),
      });
      return json(
        { error: errorMessage(profileError) },
        errorStatus(profileError),
      );
    }

    safeLog(deps, { request_id, outcome: "ok", stage: "complete" });
    return json({
      id: created.id,
      email,
      password_temporal: generado ? password : undefined,
    });
  } catch (error) {
    safeLog(deps, {
      request_id,
      outcome: "error",
      stage: error instanceof InviteError &&
          (error.message.startsWith("GC-AUTH-002") ||
            error.message.startsWith("GC-AUTH-011") ||
            error.message.startsWith("GC-AUTH-013"))
        ? "validate"
        : "authorize",
      error_code: errorCode(error),
    });
    return json({ error: errorMessage(error) }, errorStatus(error));
  }
}
