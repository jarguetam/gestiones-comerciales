import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { esLlamadorServiceRole } from "./push_authz.ts";

Deno.test("usuario autenticado no es service_role", () => {
  const req = new Request("http://n", {
    headers: { authorization: "Bearer user-jwt-token" },
  });
  assertEquals(esLlamadorServiceRole(req, "service-key-secret"), false);
});

Deno.test("service_role key acepta notify-jobs", () => {
  const req = new Request("http://n", {
    headers: { authorization: "Bearer service-key-secret" },
  });
  assertEquals(esLlamadorServiceRole(req, "service-key-secret"), true);
});
