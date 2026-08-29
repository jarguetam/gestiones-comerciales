import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

type ImporterHandler = (request: Request) => Response | Promise<Response>;

const envValues: Readonly<Record<string, string>> = {
  SUPABASE_URL: "http://supabase.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

let importerHandler: ImporterHandler | undefined;
const originalServe = Deno.serve;

Object.defineProperty(Deno.env, "get", {
  configurable: true,
  value: (key: string) => envValues[key],
  writable: true,
});
Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: ((handler: ImporterHandler) => {
    importerHandler = handler;
    return {} as Deno.HttpServer;
  }) as typeof Deno.serve,
  writable: true,
});

// Ejecuta el adaptador real sin incorporar los tipos Node transitivos de
// supabase-js al grafo estático del test. index.ts se valida con deno check.
const importerIndexUrl = new URL("./index.ts", import.meta.url).href;
await import(importerIndexUrl);

Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: originalServe,
  writable: true,
});

if (!importerHandler) {
  throw new Error("importer no registró su handler HTTP");
}

const handler: ImporterHandler = importerHandler;

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

type ScenarioOptions = {
  platformSuperadmin?: boolean;
  tenantActive?: boolean;
  rpcError?: string;
  cleanupError?: string;
};

type ScenarioResult = {
  response: Response;
  events: string[];
  uploadedPaths: string[];
  deletedPaths: string[];
  errorLogs: string[];
  userAuthHeaders: Array<string | null>;
};

function encodeJwtPart(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function jwt(aal: "aal1" | "aal2"): string {
  return [
    encodeJwtPart({ alg: "HS256", typ: "JWT" }),
    encodeJwtPart({
      sub: "platform-admin",
      aal,
      amr: [{ method: aal === "aal2" ? "totp" : "password", timestamp: 1 }],
      exp: 4_102_444_800,
    }),
    encodeJwtPart("test-signature"),
  ].join(".");
}

function multipartRequest(
  events: string[],
  options: {
    aal?: "aal1" | "aal2";
    authorization?: boolean;
    requestId?: string;
    tenantId?: string;
    tipo?: string;
  } = {},
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
    headers.set("Authorization", `Bearer ${jwt(options.aal ?? "aal2")}`);
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

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function runScenario(
  request: TrackingRequest,
  events: string[],
  options: ScenarioOptions = {},
): Promise<ScenarioResult> {
  const uploadedPaths: string[] = [];
  const deletedPaths: string[] = [];
  const errorLogs: string[] = [];
  const userAuthHeaders: Array<string | null> = [];
  let authUserCalls = 0;

  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  globalThis.fetch = async (input, init) => {
    const fetchRequest = input instanceof Request
      ? input
      : new Request(input, init);
    const url = new URL(fetchRequest.url);
    const authorization = fetchRequest.headers.get("Authorization");

    if (url.pathname === "/auth/v1/user") {
      authUserCalls += 1;
      events.push(authUserCalls === 1 ? "auth:getUser" : "auth:getAal");
      userAuthHeaders.push(authorization);
      return jsonResponse({
        id: "platform-admin",
        email: "platform@example.test",
        factors: [{
          id: "factor-1",
          status: "verified",
          factor_type: "totp",
        }],
      });
    }

    if (url.pathname === "/rest/v1/usuario_plataforma") {
      events.push("authz:platform");
      return jsonResponse(
        options.platformSuperadmin === false ? null : { id: "platform-admin" },
      );
    }

    if (url.pathname === "/rest/v1/tenant") {
      events.push("tenant:validate");
      return jsonResponse(
        options.tenantActive === false ? null : { id: "tenant-activo" },
      );
    }

    if (
      fetchRequest.method === "POST" &&
      url.pathname.startsWith("/storage/v1/object/importes/")
    ) {
      events.push("storage:upload");
      const path = decodeURIComponent(
        url.pathname.slice("/storage/v1/object/importes/".length),
      );
      uploadedPaths.push(path);
      return jsonResponse({ Key: `importes/${path}` });
    }

    if (
      fetchRequest.method === "DELETE" &&
      url.pathname === "/storage/v1/object/importes"
    ) {
      events.push("storage:remove");
      const body = await fetchRequest.json() as { prefixes?: string[] };
      deletedPaths.push(...(body.prefixes ?? []));
      if (options.cleanupError) {
        return jsonResponse({ message: options.cleanupError }, 500);
      }
      return jsonResponse({ message: "ok" });
    }

    if (url.pathname.startsWith("/rest/v1/rpc/admin_importar_")) {
      const rpc = url.pathname.slice("/rest/v1/rpc/".length);
      events.push(`rpc:${rpc}`);
      if (options.rpcError) {
        return jsonResponse({
          code: "P0001",
          details: null,
          hint: null,
          message: options.rpcError,
        }, 400);
      }
      return jsonResponse({
        insertados: 1,
        actualizados: 0,
        errores: [],
      });
    }

    if (url.pathname === "/rest/v1/rpc/registrar_edge_invocacion") {
      events.push("invocation:record");
      return jsonResponse(null);
    }

    events.push(`unexpected:${fetchRequest.method}:${url.pathname}`);
    return jsonResponse({ message: "unexpected request" }, 500);
  };
  console.log = () => {};
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "));
  };

  try {
    return {
      response: await handler(request),
      events,
      uploadedPaths,
      deletedPaths,
      errorLogs,
      userAuthHeaders,
    };
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
}

Deno.test("sin Authorization no lee el body ni toca Storage", async () => {
  const events: string[] = [];
  const request = multipartRequest(events, { authorization: false });
  const result = await runScenario(request, events);

  assertEquals(result.response.status, 401);
  assertEquals(await result.response.json(), {
    error: "GC-IMP-051: autenticación requerida",
  });
  assertEquals(request.bodyReads, 0);
  assertEquals(result.events, []);
  assertEquals(result.uploadedPaths, []);
});

Deno.test("admin o supervisor de tenant no lee el body ni toca Storage", async () => {
  const events: string[] = [];
  const request = multipartRequest(events);
  const result = await runScenario(request, events, {
    platformSuperadmin: false,
  });

  assertEquals(result.response.status, 403);
  assertEquals(await result.response.json(), {
    error: "GC-AUTH-001: requiere superadmin de plataforma",
  });
  assertEquals(request.bodyReads, 0);
  assertEquals(result.uploadedPaths, []);
  assertEquals(
    result.events,
    ["auth:getUser", "auth:getAal", "authz:platform"],
  );
});

Deno.test("superadmin con AAL1 no lee el body ni toca Storage", async () => {
  const events: string[] = [];
  const request = multipartRequest(events, { aal: "aal1" });
  const result = await runScenario(request, events);

  assertEquals(result.response.status, 403);
  assertEquals(await result.response.json(), {
    error: "GC-AUTH-014: se requiere autenticación AAL2",
  });
  assertEquals(request.bodyReads, 0);
  assertEquals(result.uploadedPaths, []);
  assertEquals(result.events, ["auth:getUser", "auth:getAal"]);
});

Deno.test("superadmin AAL2 autoriza, parsea, valida tenant, sube y ejecuta RPC en orden", async () => {
  const events: string[] = [];
  const token = jwt("aal2");
  const request = multipartRequest(events);
  const result = await runScenario(request, events);

  assertEquals(result.response.status, 200);
  assertEquals(await result.response.json(), {
    tipo: "personas",
    insertados: 1,
    actualizados: 0,
    errores: [],
    total: 1,
  });
  assertEquals(result.events, [
    "auth:getUser",
    "auth:getAal",
    "authz:platform",
    "body:formData",
    "tenant:validate",
    "storage:upload",
    "rpc:admin_importar_personas",
    "invocation:record",
  ]);
  assertEquals(result.userAuthHeaders, [
    `Bearer ${token}`,
    `Bearer ${token}`,
  ]);
  assertEquals(request.bodyReads, 1);
  assertEquals(result.uploadedPaths.length, 1);
  assertMatch(
    result.uploadedPaths[0],
    /^tenant-activo\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.csv$/,
  );
});

Deno.test("tenant inexistente o inactivo se rechaza antes de Storage", async () => {
  const events: string[] = [];
  const request = multipartRequest(events, {
    tenantId: "tenant-inexistente",
  });
  const result = await runScenario(request, events, { tenantActive: false });

  assertEquals(result.response.status, 400);
  assertEquals(await result.response.json(), {
    error: "GC-AUTH-015: tenant inexistente o inactivo",
  });
  assertEquals(result.uploadedPaths, []);
  assertEquals(result.events, [
    "auth:getUser",
    "auth:getAal",
    "authz:platform",
    "body:formData",
    "tenant:validate",
  ]);
});

Deno.test("si falla el RPC elimina el archivo subido y registra el rollback", async () => {
  const rpcError = "GC-IMP-020: el módulo creditos no está activo";
  const events: string[] = [];
  const request = multipartRequest(events, {
    requestId: "request-rpc-failure",
    tipo: "cuentas",
  });
  const result = await runScenario(request, events, { rpcError });

  assertEquals(result.response.status, 400);
  assertEquals(await result.response.json(), { error: rpcError });
  assertEquals(result.uploadedPaths.length, 1);
  assertEquals(result.deletedPaths, result.uploadedPaths);
  assertEquals(result.events.slice(-2), [
    "rpc:admin_importar_cuentas",
    "storage:remove",
  ]);
  assertEquals(result.errorLogs, [JSON.stringify({
    request_id: "request-rpc-failure",
    outcome: "error",
    stage: "rpc",
    error_code: "GC-IMP-020",
    rollback_outcome: "ok",
  })]);
});

Deno.test("si falla el cleanup conserva el error RPC y registra sin PII", async () => {
  const rpcError = "GC-IMP-020: el módulo creditos no está activo";
  const cleanupProviderError =
    "storage failure for Persona Privada <persona@example.test>";
  const events: string[] = [];
  const request = multipartRequest(events, {
    requestId: "request-cleanup-failure",
    tipo: "cuentas",
  });
  const result = await runScenario(request, events, {
    rpcError,
    cleanupError: cleanupProviderError,
  });

  assertEquals(result.response.status, 400);
  assertEquals(await result.response.json(), { error: rpcError });
  assertEquals(result.uploadedPaths.length, 1);
  assertEquals(result.deletedPaths, result.uploadedPaths);
  assertEquals(result.events.slice(-2), [
    "rpc:admin_importar_cuentas",
    "storage:remove",
  ]);
  assertEquals(result.errorLogs, [JSON.stringify({
    request_id: "request-cleanup-failure",
    outcome: "error",
    stage: "rpc",
    error_code: "GC-IMP-020",
    rollback_outcome: "error",
    rollback_error_code: "GC-IMP-018",
  })]);
  assertEquals(
    result.errorLogs.join("\n").includes(cleanupProviderError),
    false,
  );
  assertEquals(
    result.errorLogs.join("\n").includes("persona@example.test"),
    false,
  );
});
