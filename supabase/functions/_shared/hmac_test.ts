import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { timingSafeEqual } from "./hmac.ts";

const DIGEST = "0123456789abcdef".repeat(4);

Deno.test("timingSafeEqual acepta dos HMAC-SHA256 iguales", () => {
  assertEquals(DIGEST.length, 64);
  assertEquals(timingSafeEqual(DIGEST, DIGEST), true);
});

Deno.test("timingSafeEqual rechaza HMAC-SHA256 con contenido distinto", () => {
  assertEquals(timingSafeEqual(DIGEST, `f${DIGEST.slice(1)}`), false);
  assertEquals(
    timingSafeEqual(DIGEST, `${DIGEST.slice(0, 32)}f${DIGEST.slice(33)}`),
    false,
  );
  assertEquals(timingSafeEqual(DIGEST, `${DIGEST.slice(0, -1)}0`), false);
});

Deno.test("timingSafeEqual rechaza HMAC-SHA256 con longitud distinta", () => {
  assertEquals(timingSafeEqual(DIGEST, DIGEST.slice(2)), false);
  assertEquals(timingSafeEqual(DIGEST, `${DIGEST}00`), false);
});
