import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { esXlsx, parseCsv } from "./csv.ts";
import { hmacSha256Hex, normalizeFirma, timingSafeEqual } from "./hmac.ts";

Deno.test("parseCsv: encabezados, comillas y BOM", () => {
  const rows = parseCsv('\uFEFFnombre,documento\n"Finca, SA",NIT-1\n');
  assertEquals(rows.length, 1);
  assertEquals(rows[0].nombre, "Finca, SA");
  assertEquals(rows[0].documento, "NIT-1");
});

Deno.test("parseCsv: comillas sin cerrar", () => {
  assertThrows(() => parseCsv('nombre\n"sin cerrar'), Error, "GC-IMP-006");
});

Deno.test("esXlsx detecta ZIP/xlsx", () => {
  assertEquals(esXlsx(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), true);
  assertEquals(esXlsx(new Uint8Array([0x6e, 0x6f, 0x6d, 0x62])), false);
});

Deno.test("HMAC-SHA256 vector conocido (RFC 4231 truncado / fox)", async () => {
  const hex = await hmacSha256Hex(
    "key",
    "The quick brown fox jumps over the lazy dog",
  );
  assertEquals(
    hex,
    "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
  );
});

Deno.test("normalizeFirma y comparación constante", () => {
  const a = "aa".repeat(32);
  assertEquals(normalizeFirma("sha256=" + a.toUpperCase()), a);
  assertEquals(timingSafeEqual(a, a), true);
  assertEquals(timingSafeEqual(a, "bb".repeat(32)), false);
});
