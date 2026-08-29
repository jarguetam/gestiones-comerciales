import { esXlsx, parseCsv } from "../_shared/csv.ts";

export type ImporterActor = {
  userId: string;
  aal: string;
};

export type ImporterActorAuth = {
  getUser: (bearer: string) => Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  getAuthenticatorAssuranceLevel: (bearer: string) => Promise<{
    data: { currentLevel: string | null } | null;
    error: unknown;
  }>;
};

export type ImporterBatchResult = {
  insertados?: number;
  actualizados?: number;
  errores?: unknown[];
};

export type ImporterLogEntry = {
  request_id: string;
  outcome: "ok" | "error";
  stage: "authorize" | "validate" | "upload" | "rpc" | "complete";
  error_code?: string;
  rollback_outcome?: "ok" | "error";
  rollback_error_code?: string;
};

export type ImporterDeps = {
  requireActor: (request: Request) => Promise<ImporterActor>;
  isPlatformSuperadmin: (userId: string) => Promise<boolean>;
  isTenantActive: (tenantId: string) => Promise<boolean>;
  uploadFile: (
    path: string,
    bytes: Uint8Array,
  ) => Promise<void>;
  removeFile: (path: string) => Promise<void>;
  importBatch: (input: {
    rpc: string;
    arg: string;
    tenantId: string;
    rows: Record<string, unknown>[];
  }) => Promise<ImporterBatchResult | null>;
  recordInvocation: (input: {
    ok: boolean;
    durationMs: number;
    tenantId: string;
  }) => Promise<void>;
  log: (entry: ImporterLogEntry) => void;
};

export class ImporterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImporterError";
  }
}

export async function requireImporterActorFromBearer(
  request: Request,
  auth: ImporterActorAuth,
): Promise<ImporterActor> {
  const authorization = request.headers.get("Authorization");
  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) {
    throw new ImporterError("GC-IMP-051: autenticación requerida");
  }

  const { data: userData, error: userError } = await auth.getUser(bearer);
  if (userError || !userData.user) {
    throw new ImporterError("GC-IMP-051: autenticación requerida");
  }

  const { data: assurance, error: assuranceError } = await auth
    .getAuthenticatorAssuranceLevel(bearer);
  if (assuranceError || !assurance) {
    throw new ImporterError(
      "GC-AUTH-012: no se pudo verificar el nivel de seguridad",
    );
  }

  return {
    userId: userData.user.id,
    aal: assurance.currentLevel ?? "aal1",
  };
}

type ParsedImport = {
  tipo: string;
  tenantId: string;
  filas: Record<string, unknown>[];
  archivoBytes: Uint8Array | null;
};

const TIPOS = new Set(["personas", "cuentas", "catalogos"]);
const RPC: Readonly<Record<string, string>> = {
  personas: "admin_importar_personas",
  cuentas: "admin_importar_cuentas",
  catalogos: "admin_importar_catalogos",
};
const ARG: Readonly<Record<string, string>> = {
  personas: "p_personas",
  cuentas: "p_cuentas",
  catalogos: "p_filas",
};
const MAX_FILAS = 5000;
const LOTE = 500;
const DEFAULT_ERROR_CODE = "GC-IMP-018";
const DEFAULT_ERROR_MESSAGE = "GC-IMP-018: no se pudo completar la importación";
const EXPOSED_ERRORS = {
  "GC-AUTH-001": {
    message: "GC-AUTH-001: requiere superadmin de plataforma",
    status: 403,
  },
  "GC-AUTH-012": {
    message: "GC-AUTH-012: no se pudo verificar la autorización",
    status: 500,
  },
  "GC-AUTH-014": {
    message: "GC-AUTH-014: se requiere autenticación AAL2",
    status: 403,
  },
  "GC-IMP-001": {
    message: "GC-IMP-001: nombre y documento son obligatorios",
    status: 400,
  },
  "GC-IMP-002": {
    message: "GC-IMP-002: exporte el Excel a CSV e inténtelo de nuevo",
    status: 400,
  },
  "GC-IMP-003": {
    message: `GC-IMP-003: máximo ${MAX_FILAS} filas por carga`,
    status: 400,
  },
  "GC-IMP-006": {
    message: "GC-IMP-006: CSV con comillas sin cerrar",
    status: 400,
  },
  "GC-IMP-013": {
    message: "GC-IMP-013: se requiere archivo CSV",
    status: 400,
  },
  "GC-IMP-014": {
    message: "GC-IMP-014: tipo debe ser personas, cuentas o catalogos",
    status: 400,
  },
  "GC-IMP-015": {
    message: "GC-IMP-015: tenant_id requerido",
    status: 400,
  },
  "GC-IMP-016": {
    message: "GC-IMP-016: el archivo no tiene filas",
    status: 400,
  },
  "GC-IMP-017": {
    message: "GC-IMP-017: payload inválido",
    status: 400,
  },
  "GC-IMP-018": {
    message: DEFAULT_ERROR_MESSAGE,
    status: 500,
  },
  "GC-IMP-020": {
    message: "GC-IMP-020: el módulo creditos no está activo",
    status: 400,
  },
  "GC-IMP-050": {
    message: "GC-IMP-050: método no permitido",
    status: 405,
  },
  "GC-IMP-051": {
    message: "GC-IMP-051: autenticación requerida",
    status: 401,
  },
} as const;

type ExposedErrorCode = keyof typeof EXPOSED_ERRORS;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
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

function errorCode(error: unknown): ExposedErrorCode {
  const extracted = rawErrorMessage(error)?.match(
    /\bGC-[A-Z]+-\d{3}\b/,
  )?.[0];
  return extracted && Object.hasOwn(EXPOSED_ERRORS, extracted)
    ? extracted as ExposedErrorCode
    : DEFAULT_ERROR_CODE;
}

function errorMessage(error: unknown): string {
  return EXPOSED_ERRORS[errorCode(error)].message;
}

function errorStatus(error: unknown): number {
  return EXPOSED_ERRORS[errorCode(error)].status;
}

function safeLog(deps: ImporterDeps, entry: ImporterLogEntry): void {
  try {
    deps.log(entry);
  } catch {
    // El logging nunca debe alterar la respuesta ni impedir el rollback.
  }
}

function filasDesdeCsv(
  tipo: string,
  rows: Record<string, string>[],
): Record<string, unknown>[] {
  if (tipo === "catalogos") {
    return rows.map((row) => ({
      tipo: row.tipo,
      nombre: row.nombre,
      codigo: row.codigo,
      actividad: row.actividad,
      cantidad: row.cantidad,
      activo: row.activo,
    }));
  }
  return rows as Record<string, unknown>[];
}

async function parseRequest(request: Request): Promise<ParsedImport> {
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ??
      "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const tipo = String(form.get("tipo") ?? "").toLowerCase();
      const tenantId = String(form.get("tenant_id") ?? "").trim();
      const file = form.get("file") ?? form.get("archivo");
      if (!(file instanceof File)) {
        throw new ImporterError("GC-IMP-013: se requiere archivo CSV");
      }

      const archivoBytes = new Uint8Array(await file.arrayBuffer());
      if (esXlsx(archivoBytes)) {
        throw new ImporterError(
          "GC-IMP-002: exporte el Excel a CSV e inténtelo de nuevo",
        );
      }
      const text = new TextDecoder("utf-8").decode(archivoBytes);
      return {
        tipo,
        tenantId,
        filas: filasDesdeCsv(tipo, parseCsv(text)),
        archivoBytes,
      };
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ImporterError("GC-IMP-017: payload inválido");
    }
    const payload = body as Record<string, unknown>;
    const tipo = String(payload.tipo ?? "").toLowerCase();
    const tenantId = String(payload.tenant_id ?? "").trim();
    const raw = payload.filas ?? payload.personas ?? payload.cuentas;
    if (!Array.isArray(raw)) {
      throw new ImporterError("GC-IMP-017: payload inválido");
    }
    return {
      tipo,
      tenantId,
      filas: raw as Record<string, unknown>[],
      archivoBytes: null,
    };
  } catch (error) {
    if (
      error instanceof ImporterError ||
      rawErrorMessage(error)?.startsWith("GC-")
    ) {
      throw error;
    }
    throw new ImporterError("GC-IMP-017: payload inválido");
  }
}

function validateImport(parsed: ParsedImport): void {
  if (!TIPOS.has(parsed.tipo)) {
    throw new ImporterError(
      "GC-IMP-014: tipo debe ser personas, cuentas o catalogos",
    );
  }
  if (!parsed.tenantId) {
    throw new ImporterError("GC-IMP-015: tenant_id requerido");
  }
  if (parsed.filas.length === 0) {
    throw new ImporterError("GC-IMP-016: el archivo no tiene filas");
  }
  if (parsed.filas.length > MAX_FILAS) {
    throw new ImporterError(
      `GC-IMP-003: máximo ${MAX_FILAS} filas por carga`,
    );
  }
}

async function rollbackUpload(
  deps: ImporterDeps,
  path: string,
): Promise<
  Pick<
    ImporterLogEntry,
    "rollback_outcome" | "rollback_error_code"
  >
> {
  try {
    await deps.removeFile(path);
    return { rollback_outcome: "ok" };
  } catch {
    return {
      rollback_outcome: "error",
      rollback_error_code: DEFAULT_ERROR_CODE,
    };
  }
}

export async function importar(
  deps: ImporterDeps,
  request: Request,
): Promise<Response> {
  const startedAt = Date.now();
  const request_id = requestId(request);

  if (request.method !== "POST") {
    return json({ error: "GC-IMP-050: método no permitido" }, 405);
  }

  let stage: ImporterLogEntry["stage"] = "authorize";
  try {
    const actor = await deps.requireActor(request);
    if (actor.aal !== "aal2") {
      throw new ImporterError(
        "GC-AUTH-014: se requiere autenticación AAL2",
      );
    }
    if (!await deps.isPlatformSuperadmin(actor.userId)) {
      throw new ImporterError(
        "GC-AUTH-001: requiere superadmin de plataforma",
      );
    }

    stage = "validate";
    const parsed = await parseRequest(request);
    validateImport(parsed);
    if (!await deps.isTenantActive(parsed.tenantId)) {
      throw new ImporterError(DEFAULT_ERROR_MESSAGE);
    }

    let uploadedPath: string | null = null;
    if (parsed.archivoBytes) {
      stage = "upload";
      uploadedPath = `${parsed.tenantId}/${
        new Date().toISOString().slice(0, 10)
      }/${crypto.randomUUID()}.csv`;
      await deps.uploadFile(uploadedPath, parsed.archivoBytes);
    }

    stage = "rpc";
    let insertados = 0;
    let actualizados = 0;
    const errores: unknown[] = [];
    const rpc = RPC[parsed.tipo];
    const arg = ARG[parsed.tipo];

    for (let index = 0; index < parsed.filas.length; index += LOTE) {
      const chunk = parsed.filas.slice(index, index + LOTE);
      let result: ImporterBatchResult | null;
      try {
        result = await deps.importBatch({
          rpc,
          arg,
          tenantId: parsed.tenantId,
          rows: chunk,
        });
      } catch (rpcError) {
        const rollback = uploadedPath
          ? await rollbackUpload(deps, uploadedPath)
          : {};
        safeLog(deps, {
          request_id,
          outcome: "error",
          stage: "rpc",
          error_code: errorCode(rpcError),
          ...rollback,
        });
        return json(
          { error: errorMessage(rpcError) },
          errorStatus(rpcError),
        );
      }

      insertados += result?.insertados ?? 0;
      actualizados += result?.actualizados ?? 0;
      if (Array.isArray(result?.errores)) {
        for (const error of result.errores) {
          if (error && typeof error === "object" && "fila" in error) {
            errores.push({
              ...(error as Record<string, unknown>),
              fila: Number((error as { fila: number }).fila) + index,
            });
          } else {
            errores.push(error);
          }
        }
      }
    }

    stage = "complete";
    safeLog(deps, { request_id, outcome: "ok", stage });
    await deps.recordInvocation({
      ok: true,
      durationMs: Date.now() - startedAt,
      tenantId: parsed.tenantId,
    });
    const status = parsed.filas.length > 2000 ? 202 : 200;
    return json({
      tipo: parsed.tipo,
      insertados,
      actualizados,
      errores,
      total: parsed.filas.length,
    }, status);
  } catch (error) {
    safeLog(deps, {
      request_id,
      outcome: "error",
      stage,
      error_code: errorCode(error),
    });
    return json({ error: errorMessage(error) }, errorStatus(error));
  }
}
