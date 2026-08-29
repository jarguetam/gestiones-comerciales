import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  importar,
  type ImporterDeps,
  type ImporterLogEntry,
  requireImporterActorFromBearer,
} from "./importer.ts";

class TrackingRequest extends Request {
  bodyReads = 0;

  override json(): Promise<unknown> {
    this.bodyReads += 1;
    return super.json();
  }

  override formData(): Promise<FormData> {
    this.bodyReads += 1;
    return super.formData();
  }
}

type HarnessOptions = {
  aal?: "aal1" | "aal2";
  platformSuperadmin?: boolean;
  tenantActive?: boolean;
  rpcError?: string;
  cleanupError?: string;
};

type Harness = {
  deps: ImporterDeps;
  events: string[];
  uploadedPaths: string[];
  deletedPaths: string[];
  logs: ImporterLogEntry[];
};

function multipartRequest(
  options: {
    authorization?: boolean;
    requestId?: string;
    tenantId?: string;
    tipo?: string;
  } = {},
  events: string[] = [],
): TrackingRequest {
  const form = new FormData();
  form.set("tipo", options.tipo ?? "personas");
  form.set("tenant_id", options.tenantId ?? "tenant-activo");
  form.set(
    "file",
    new File(
      ["nombre,documento\nPersona Privada,DOC-1\n"],
      "personas.csv",
      { type: "text/csv" },
    ),
  );

  const headers = new Headers({
    "x-request-id": options.requestId ?? "request-test",
  });
  if (options.authorization !== false) {
    headers.set("Authorization", "Bearer test-bearer");
  }

  const request = new TrackingRequest("http://local/importer", {
    method: "POST",
    headers,
    body: form,
  });
  const nativeFormData = request.formData.bind(request);
  request.formData = () => {
    events.push("body:formData");
    return nativeFormData();
  };
  return request;
}

function harness(options: HarnessOptions = {}): Harness {
  const events: string[] = [];
  const uploadedPaths: string[] = [];
  const deletedPaths: string[] = [];
  const logs: ImporterLogEntry[] = [];

  return {
    events,
    uploadedPaths,
    deletedPaths,
    logs,
    deps: {
      requireActor: async () => {
        events.push("auth:actor");
        return {
          userId: "platform-admin",
          aal: options.aal ?? "aal2",
        };
      },
      isPlatformSuperadmin: async (userId) => {
        events.push(`authz:platform:${userId}`);
        return options.platformSuperadmin !== false;
      },
      isTenantActive: async (tenantId) => {
        events.push(`tenant:validate:${tenantId}`);
        return options.tenantActive !== false;
      },
      uploadFile: async (path) => {
        events.push("storage:upload");
        uploadedPaths.push(path);
      },
      removeFile: async (path) => {
        events.push("storage:remove");
        deletedPaths.push(path);
        if (options.cleanupError) {
          throw new Error(options.cleanupError);
        }
      },
      importBatch: async ({ rpc }) => {
        events.push(`rpc:${rpc}`);
        if (options.rpcError) {
          throw new Error(options.rpcError);
        }
        return {
          insertados: 1,
          actualizados: 0,
          errores: [],
        };
      },
      recordInvocation: async () => {
        events.push("invocation:record");
      },
      log: (entry) => logs.push(entry),
    },
  };
}

Deno.test("sin Authorization no lee el body ni toca Storage", async () => {
  const state = harness();
  state.deps.requireActor = (request) =>
    requireImporterActorFromBearer(request, {
      getUser: () => {
        throw new Error("getUser no debe ejecutarse sin bearer");
      },
      getAuthenticatorAssuranceLevel: () => {
        throw new Error("AAL no debe ejecutarse sin bearer");
      },
    });
  const request = multipartRequest(
    { authorization: false },
    state.events,
  );

  const response = await importar(state.deps, request);

  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: "GC-IMP-051: autenticación requerida",
  });
  assertEquals(request.bodyReads, 0);
  assertEquals(state.uploadedPaths, []);
  assertEquals(state.events, []);
});

Deno.test("admin o supervisor de tenant no lee el body ni toca Storage", async () => {
  const state = harness({ platformSuperadmin: false });
  const request = multipartRequest({}, state.events);

  const response = await importar(state.deps, request);

  assertEquals(response.status, 403);
  assertEquals(await response.json(), {
    error: "GC-AUTH-001: requiere superadmin de plataforma",
  });
  assertEquals(request.bodyReads, 0);
  assertEquals(state.uploadedPaths, []);
  assertEquals(state.events, [
    "auth:actor",
    "authz:platform:platform-admin",
  ]);
});

Deno.test("superadmin con AAL1 no lee el body ni toca Storage", async () => {
  const state = harness({ aal: "aal1" });
  const request = multipartRequest({}, state.events);

  const response = await importar(state.deps, request);

  assertEquals(response.status, 403);
  assertEquals(await response.json(), {
    error: "GC-AUTH-014: se requiere autenticación AAL2",
  });
  assertEquals(request.bodyReads, 0);
  assertEquals(state.uploadedPaths, []);
  assertEquals(state.events, ["auth:actor"]);
});

Deno.test("el bearer se pasa explícitamente a getUser y a la API oficial de AAL", async () => {
  const calls: string[] = [];
  const request = multipartRequest();

  const actor = await requireImporterActorFromBearer(request, {
    getUser: async (bearer) => {
      calls.push(`getUser:${bearer}`);
      return {
        data: { user: { id: "platform-admin" } },
        error: null,
      };
    },
    getAuthenticatorAssuranceLevel: async (bearer) => {
      calls.push(`getAal:${bearer}`);
      return {
        data: { currentLevel: "aal2" },
        error: null,
      };
    },
  });

  assertEquals(actor, { userId: "platform-admin", aal: "aal2" });
  assertEquals(calls, [
    "getUser:test-bearer",
    "getAal:test-bearer",
  ]);
});

Deno.test("superadmin AAL2 autoriza, parsea, valida tenant, sube y ejecuta RPC en orden", async () => {
  const state = harness();
  const request = multipartRequest({}, state.events);

  const response = await importar(state.deps, request);

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    tipo: "personas",
    insertados: 1,
    actualizados: 0,
    errores: [],
    total: 1,
  });
  assertEquals(state.events, [
    "auth:actor",
    "authz:platform:platform-admin",
    "body:formData",
    "tenant:validate:tenant-activo",
    "storage:upload",
    "rpc:admin_importar_personas",
    "invocation:record",
  ]);
  assertEquals(request.bodyReads, 1);
  assertEquals(state.uploadedPaths.length, 1);
  assertMatch(
    state.uploadedPaths[0],
    /^tenant-activo\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.csv$/,
  );
});

Deno.test("tenant inexistente o inactivo se rechaza antes de Storage", async () => {
  const state = harness({ tenantActive: false });
  const request = multipartRequest(
    { tenantId: "tenant-inexistente" },
    state.events,
  );

  const response = await importar(state.deps, request);

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "GC-AUTH-015: tenant inexistente o inactivo",
  });
  assertEquals(state.uploadedPaths, []);
  assertEquals(state.events, [
    "auth:actor",
    "authz:platform:platform-admin",
    "body:formData",
    "tenant:validate:tenant-inexistente",
  ]);
});

Deno.test("si falla el RPC elimina el archivo subido y registra el rollback", async () => {
  const rpcError = "GC-IMP-020: el módulo creditos no está activo";
  const state = harness({ rpcError });
  const request = multipartRequest(
    {
      requestId: "request-rpc-failure",
      tipo: "cuentas",
    },
    state.events,
  );

  const response = await importar(state.deps, request);

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: rpcError });
  assertEquals(state.uploadedPaths.length, 1);
  assertEquals(state.deletedPaths, state.uploadedPaths);
  assertEquals(state.events.slice(-2), [
    "rpc:admin_importar_cuentas",
    "storage:remove",
  ]);
  assertEquals(state.logs.at(-1), {
    request_id: "request-rpc-failure",
    outcome: "error",
    stage: "rpc",
    error_code: "GC-IMP-020",
    rollback_outcome: "ok",
  });
});

Deno.test("si falla el cleanup conserva el error RPC y registra sin PII", async () => {
  const rpcError = "GC-IMP-020: el módulo creditos no está activo";
  const cleanupProviderError =
    "storage failure for Persona Privada <persona@example.test>";
  const state = harness({ rpcError, cleanupError: cleanupProviderError });
  const request = multipartRequest(
    {
      requestId: "request-cleanup-failure",
      tipo: "cuentas",
    },
    state.events,
  );

  const response = await importar(state.deps, request);

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: rpcError });
  assertEquals(state.uploadedPaths.length, 1);
  assertEquals(state.deletedPaths, state.uploadedPaths);
  assertEquals(state.events.slice(-2), [
    "rpc:admin_importar_cuentas",
    "storage:remove",
  ]);
  assertEquals(state.logs.at(-1), {
    request_id: "request-cleanup-failure",
    outcome: "error",
    stage: "rpc",
    error_code: "GC-IMP-020",
    rollback_outcome: "error",
    rollback_error_code: "GC-IMP-018",
  });
  const serializedLogs = JSON.stringify(state.logs);
  assertEquals(serializedLogs.includes(cleanupProviderError), false);
  assertEquals(serializedLogs.includes("persona@example.test"), false);
});
