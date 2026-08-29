import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  invitarUsuario,
  type InviteDeps,
  type InviteLogEntry,
  requireActorFromBearer,
} from "./invitar.ts";

const validBody = {
  tenant_id: "tenant-request",
  email: "Persona@Example.com ",
  nombre: "Persona",
  rol: "asesor",
  password: "password-seguro",
  jefe_id: "jefe-1",
  zona_id: 7,
};

function request(
  body: unknown = validBody,
  requestId = "request-test",
): Request {
  return new Request("http://local/invitar-usuario", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
}

type InviteDepsWithTenantCheck = InviteDeps & {
  isTenantActive: (tenantId: string) => Promise<boolean>;
};

function deps(
  overrides: Partial<InviteDepsWithTenantCheck> = {},
): InviteDepsWithTenantCheck {
  return {
    requireActor: async () => ({ userId: "platform-admin", aal: "aal2" }),
    isPlatformSuperadmin: async () => true,
    isTenantActive: async () => true,
    createUser: async () => ({ id: "auth-new" }),
    inviteProfile: async () => {},
    deleteUser: async () => {},
    log: () => {},
    ...overrides,
  };
}

Deno.test("admin o supervisor de tenant no crea usuarios", async () => {
  let created = 0;
  const res = await invitarUsuario(
    deps({
      requireActor: async () => ({ userId: "tenant-admin", aal: "aal2" }),
      isPlatformSuperadmin: async () => false,
      createUser: async () => {
        created += 1;
        return { id: "unexpected" };
      },
    }),
    request(),
  );

  assertEquals(res.status, 403);
  assertEquals(await res.json(), {
    error: "GC-AUTH-001: requiere superadmin de plataforma",
  });
  assertEquals(created, 0);
});

Deno.test("superadmin con AAL1 no consulta membresía ni crea usuarios", async () => {
  let membershipChecks = 0;
  let created = 0;
  const res = await invitarUsuario(
    deps({
      requireActor: async () => ({ userId: "platform-admin", aal: "aal1" }),
      isPlatformSuperadmin: async () => {
        membershipChecks += 1;
        return true;
      },
      createUser: async () => {
        created += 1;
        return { id: "unexpected" };
      },
    }),
    request(),
  );

  assertEquals(res.status, 403);
  assertEquals(await res.json(), {
    error: "GC-AUTH-014: se requiere autenticación AAL2",
  });
  assertEquals(membershipChecks, 0);
  assertEquals(created, 0);
});

Deno.test("el bearer AAL2 se verifica explícitamente y llega a la orquestación", async () => {
  const authCalls: string[] = [];
  const orchestrationCalls: string[] = [];
  const req = request();
  req.headers.set("Authorization", "Bearer jwt-aal2");

  const res = await invitarUsuario(
    deps({
      requireActor: (request) =>
        requireActorFromBearer(request, {
          getUser: async (jwt) => {
            authCalls.push(`getUser:${jwt}`);
            return {
              data: { user: { id: "platform-admin" } },
              error: null,
            };
          },
          getAuthenticatorAssuranceLevel: async (jwt) => {
            authCalls.push(`getAal:${jwt}`);
            return {
              data: { currentLevel: "aal2" },
              error: null,
            };
          },
        }),
      isPlatformSuperadmin: async (userId) => {
        orchestrationCalls.push(`isPlatformSuperadmin:${userId}`);
        return true;
      },
      createUser: async () => {
        orchestrationCalls.push("createUser");
        return { id: "auth-new" };
      },
    }),
    req,
  );

  assertEquals(res.status, 200);
  assertEquals(authCalls, [
    "getUser:jwt-aal2",
    "getAal:jwt-aal2",
  ]);
  assertEquals(orchestrationCalls, [
    "isPlatformSuperadmin:platform-admin",
    "createUser",
  ]);
});

Deno.test("invita en el tenant del request y conserva jefe_id y zona_id", async () => {
  const calls: string[] = [];
  let createInput: Parameters<InviteDeps["createUser"]>[0] | undefined;
  let profileInput: Parameters<InviteDeps["inviteProfile"]>[0] | undefined;
  let deleted = 0;

  const res = await invitarUsuario(
    deps({
      requireActor: async () => {
        calls.push("requireActor");
        return { userId: "platform-admin", aal: "aal2" };
      },
      isPlatformSuperadmin: async (userId) => {
        calls.push(`isPlatformSuperadmin:${userId}`);
        return true;
      },
      createUser: async (input) => {
        calls.push("createUser");
        createInput = input;
        return { id: "auth-new" };
      },
      inviteProfile: async (input) => {
        calls.push("inviteProfile");
        profileInput = input;
      },
      deleteUser: async () => {
        deleted += 1;
      },
      log: (entry) => calls.push(`log:${entry.outcome}`),
    }),
    request(),
  );

  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    id: "auth-new",
    email: "persona@example.com",
  });
  assertEquals(createInput, {
    email: "persona@example.com",
    password: "password-seguro",
    metadata: { nombre: "Persona" },
  });
  assertEquals(profileInput, {
    authUserId: "auth-new",
    tenantId: "tenant-request",
    email: "persona@example.com",
    rol: "asesor",
    nombre: "Persona",
    jefeId: "jefe-1",
    zonaId: 7,
  });
  assertEquals(calls, [
    "requireActor",
    "isPlatformSuperadmin:platform-admin",
    "createUser",
    "inviteProfile",
    "log:ok",
  ]);
  assertEquals(deleted, 0);
});

Deno.test("un rol inválido se rechaza antes de createUser", async () => {
  let created = 0;
  const res = await invitarUsuario(
    deps({
      createUser: async () => {
        created += 1;
        return { id: "unexpected" };
      },
    }),
    request({ ...validBody, rol: "owner" }),
  );

  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: "GC-AUTH-002: rol inválido" });
  assertEquals(created, 0);
});

Deno.test("tenant inexistente o inactivo se rechaza antes de createUser", async () => {
  const logs: InviteLogEntry[] = [];
  const checkedTenants: string[] = [];
  let created = 0;

  const res = await invitarUsuario(
    deps({
      isTenantActive: async (tenantId) => {
        checkedTenants.push(tenantId);
        return false;
      },
      createUser: async () => {
        created += 1;
        return { id: "unexpected" };
      },
      log: (entry) => logs.push(entry),
    }),
    request(
      { ...validBody, tenant_id: "tenant-inexistente-o-inactivo" },
      "request-invalid-tenant",
    ),
  );

  assertEquals(res.status, 400);
  assertEquals(await res.json(), {
    error: "GC-AUTH-015: tenant inexistente o inactivo",
  });
  assertEquals(checkedTenants, ["tenant-inexistente-o-inactivo"]);
  assertEquals(created, 0);
  assertEquals(logs, [{
    request_id: "request-invalid-tenant",
    outcome: "error",
    stage: "validate",
    error_code: "GC-AUTH-015",
  }]);
});

Deno.test("si falla el perfil elimina de inmediato el usuario Auth", async () => {
  const calls: string[] = [];
  const logs: InviteLogEntry[] = [];
  let deleted = "";
  const profileError = "GC-AUTH-003: usuario de auth no existe";

  const res = await invitarUsuario(
    deps({
      createUser: async () => {
        calls.push("createUser");
        return { id: "auth-new" };
      },
      inviteProfile: async () => {
        calls.push("inviteProfile");
        throw new Error(profileError);
      },
      deleteUser: async (id) => {
        calls.push("deleteUser");
        deleted = id;
      },
      log: (entry) => logs.push(entry),
    }),
    request(validBody, "request-rollback"),
  );

  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: profileError });
  assertEquals(deleted, "auth-new");
  assertEquals(calls, ["createUser", "inviteProfile", "deleteUser"]);
  assertEquals(logs, [{
    request_id: "request-rollback",
    outcome: "error",
    stage: "invite_profile",
    error_code: "GC-AUTH-003",
    rollback_outcome: "ok",
  }]);
});

Deno.test("si el rollback falla conserva el error de perfil y registra ambos sin PII", async () => {
  const logs: InviteLogEntry[] = [];
  const profileError = "GC-AUTH-002: rol inválido";

  const res = await invitarUsuario(
    deps({
      inviteProfile: async () => {
        throw new Error(profileError);
      },
      deleteUser: async () => {
        throw new Error("rollback failure for Persona@Example.com");
      },
      log: (entry) => logs.push(entry),
    }),
    request(validBody, "request-rollback-failed"),
  );

  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: profileError });
  assertEquals(logs, [{
    request_id: "request-rollback-failed",
    outcome: "error",
    stage: "invite_profile",
    error_code: "GC-AUTH-002",
    rollback_outcome: "error",
    rollback_error_code: "GC-AUTH-012",
  }]);
  assertEquals(JSON.stringify(logs).includes("Persona@Example.com"), false);
  assertStringIncludes(JSON.stringify(logs), "request-rollback-failed");
});

Deno.test("un error PostgREST no catalogado se responde y registra sin PII", async () => {
  const logs: InviteLogEntry[] = [];
  const providerMessage =
    "duplicate key for Persona@Example.com in usuario_email_key";

  const res = await invitarUsuario(
    deps({
      inviteProfile: async () => {
        throw new Error(providerMessage);
      },
      log: (entry) => logs.push(entry),
    }),
    request(validBody, "request-postgrest-error"),
  );

  assertEquals(res.status, 500);
  assertEquals(await res.json(), {
    error: "GC-AUTH-012: no se pudo completar la invitación",
  });
  assertEquals(logs, [{
    request_id: "request-postgrest-error",
    outcome: "error",
    stage: "invite_profile",
    error_code: "GC-AUTH-012",
    rollback_outcome: "ok",
  }]);
  assertEquals(JSON.stringify(logs).includes(providerMessage), false);
  assertEquals(JSON.stringify(logs).includes("Persona@Example.com"), false);
});
