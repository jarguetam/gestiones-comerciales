import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("pdf-solicitud no usa SERVICE_ROLE", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(/SERVICE_ROLE|service_role/.test(src), false);
});
