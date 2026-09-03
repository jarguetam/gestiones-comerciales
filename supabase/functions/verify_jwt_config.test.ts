import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CONFIG = readFileSync(join(ROOT, "supabase/config.toml"), "utf8");

const FUNCTIONS = [
  "auth-guard",
  "rastreo-ingesta",
  "push-notifications",
  "pdf-solicitud",
  "invitar-usuario",
  "notify-jobs",
  "importer",
  "webhook-tenant",
] as const;

const EXPECTED: Record<(typeof FUNCTIONS)[number], boolean> = {
  "auth-guard": false,
  "webhook-tenant": false,
  "notify-jobs": false,
  "rastreo-ingesta": true,
  "push-notifications": true,
  "pdf-solicitud": true,
  "invitar-usuario": true,
  importer: true,
};

test("config.toml declara verify_jwt para las 8 Edge Functions", () => {
  for (const name of FUNCTIONS) {
    const block = new RegExp(
      `\\[functions\\.${
        name.replace("-", "\\-")
      }\\][\\s\\S]*?verify_jwt\\s*=\\s*(true|false)`,
    );
    const m = CONFIG.match(block);
    assert.ok(m, `falta bloque [functions.${name}] con verify_jwt`);
    const value = m[1] === "true";
    assert.equal(value, EXPECTED[name], `verify_jwt de ${name}`);
  }
});
