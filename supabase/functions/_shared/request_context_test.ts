import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logEdge, readRequestContext, toEdgeLog } from "./request_context.ts";

Deno.test("readRequestContext respeta x-request-id de hasta 64 chars", () => {
  const req = new Request("https://example.test/fn", {
    headers: { "x-request-id": "req-abc-123" },
  });
  assertEquals(readRequestContext(req).requestId, "req-abc-123");
  assertEquals(readRequestContext(req).requestId, "req-abc-123");
});

Deno.test("readRequestContext genera UUID si falta el header", () => {
  const req = new Request("https://example.test/fn");
  const id = readRequestContext(req).requestId;
  assertMatch(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

Deno.test("readRequestContext ignora headers demasiado largos", () => {
  const req = new Request("https://example.test/fn", {
    headers: { "x-request-id": "x".repeat(65) },
  });
  assertMatch(readRequestContext(req).requestId, /^[0-9a-f-]{36}$/i);
});

Deno.test("logEdge es JSON parseable y no incluye Authorization ni email", () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(" "));
  };
  try {
    logEdge(
      toEdgeLog(
        { requestId: "rid-1" },
        { tenant_id: "t1", sub: "u1" },
        "auth-guard",
        "ok",
      ),
      { duration_ms: 12 },
    );
  } finally {
    console.log = original;
  }
  assertEquals(lines.length, 1);
  const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
  assertEquals(parsed.request_id, "rid-1");
  assertEquals(parsed.tenant_id, "t1");
  assertEquals(parsed.user_id, "u1");
  assertEquals(parsed.fn, "auth-guard");
  assertEquals(parsed.outcome, "ok");
  const raw = lines[0].toLowerCase();
  if (
    raw.includes("authorization") || raw.includes("bearer") || raw.includes("@")
  ) {
    throw new Error("el log no debe incluir Authorization ni email");
  }
});

Deno.test("toEdgeLog no copia claims extra (email)", () => {
  const fields = toEdgeLog(
    { requestId: "r" },
    { tenant_id: "t", sub: "u", email: "a@b.c" } as {
      tenant_id?: string;
      sub?: string;
    },
    "importer",
    "error",
  );
  assertEquals("email" in fields, false);
  assertEquals(fields.outcome, "error");
});
