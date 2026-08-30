import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  corsHeadersForOrigin,
  handleAuthGuard,
  hashEmail,
  parseClientIp,
  type AuthGuardDeps,
} from "./auth_guard.ts";

function baseDeps(overrides: Partial<AuthGuardDeps> = {}): AuthGuardDeps {
  return {
    signIn: async () => ({
      session: {
        access_token: "access",
        refresh_token: "refresh",
      },
      error: null,
    }),
    getAuthenticatorAssuranceLevel: async () => ({
      data: { currentLevel: "aal1", nextLevel: null },
      error: null,
    }),
    countRecentFails: async () => 0,
    recordEvent: async () => {},
    log: () => {},
    ...overrides,
  };
}

const allowed = [
  "http://localhost:5173",
  "https://jarguetam.github.io",
];

Deno.test("OPTIONS sin ALLOWED_ORIGINS responde 500 GC-CORE-001", async () => {
  const res = await handleAuthGuard(
    baseDeps(),
    new Request("http://n", { method: "OPTIONS", headers: { origin: allowed[0] } }),
    [],
  );
  assertEquals(res.status, 500);
  assertEquals(await res.json(), {
    error: "GC-CORE-001: configuración CORS incompleta",
  });
});

Deno.test("origen no permitido no devuelve Access-Control-Allow-Origin", async () => {
  const res = await handleAuthGuard(
    baseDeps(),
    new Request("http://n", {
      method: "POST",
      headers: { origin: "https://evil.example" },
      body: JSON.stringify({ email: "a@b.c", password: "x" }),
    }),
    allowed,
  );
  assertEquals(res.status, 403);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("el sexto intento fallido desde la misma IP responde 429", async () => {
  let blocked = 0;
  const deps = baseDeps({
    countRecentFails: async () => 5,
    signIn: async () => {
      throw new Error("no debe intentar login");
    },
    recordEvent: async ({ outcome }) => {
      if (outcome === "blocked") blocked += 1;
    },
  });
  const res = await handleAuthGuard(
    deps,
    new Request("http://n", {
      method: "POST",
      headers: {
        origin: allowed[0],
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify({ email: "a@b.c", password: "secret" }),
    }),
    allowed,
  );
  assertEquals(res.status, 429);
  assertEquals(blocked, 1);
  const body = await res.json();
  assertEquals(body.error, "GC-AUTH-040: demasiados intentos de inicio de sesión");
});

Deno.test("login exitoso registra ok y devuelve sesión", async () => {
  const events: string[] = [];
  const deps = baseDeps({
    recordEvent: async ({ outcome }) => {
      events.push(outcome);
    },
  });
  const res = await handleAuthGuard(
    deps,
    new Request("http://n", {
      method: "POST",
      headers: { origin: allowed[0] },
      body: JSON.stringify({ email: "ok@example.com", password: "secret" }),
    }),
    allowed,
  );
  assertEquals(res.status, 200);
  assertEquals(events, ["ok"]);
  const body = await res.json();
  assertEquals(body.session.access_token, "access");
});

Deno.test("login fallido registra fail", async () => {
  const events: string[] = [];
  const deps = baseDeps({
    signIn: async () => ({ session: null, error: new Error("bad") }),
    recordEvent: async ({ outcome }) => {
      events.push(outcome);
    },
  });
  const res = await handleAuthGuard(
    deps,
    new Request("http://n", {
      method: "POST",
      headers: { origin: allowed[0] },
      body: JSON.stringify({ email: "bad@example.com", password: "x" }),
    }),
    allowed,
  );
  assertEquals(res.status, 401);
  assertEquals(events, ["fail"]);
});

Deno.test("parseClientIp usa el primer hop de x-forwarded-for", () => {
  const req = new Request("http://n", {
    headers: { "x-forwarded-for": " 2001:db8::1 , 10.0.0.2 " },
  });
  assertEquals(parseClientIp(req), "2001:db8::1");
});

Deno.test("hashEmail es determinístico y no guarda el email en claro", async () => {
  const a = await hashEmail("User@Example.com");
  const b = await hashEmail("user@example.com");
  assertEquals(a, b);
  assertEquals(a.includes("@"), false);
});

Deno.test("corsHeadersForOrigin refleja solo orígenes permitidos", () => {
  const headers = corsHeadersForOrigin(
    new Request("http://n", { headers: { origin: allowed[0] } }),
    allowed,
  );
  assertEquals(headers?.["Access-Control-Allow-Origin"], allowed[0]);
});
