/**
 * Edge Function: webhook-tenant
 * Entrada firmada HMAC para sistemas del rubro (verify_jwt = false).
 * Encola en integracion_evento y procesa persona.upsert / cuenta.snapshot / catalogo.upsert.
 *
 * Headers: X-GC-Tenant-Id (uuid) o X-GC-Tenant (codigo)
 *          X-GC-Signature: hex | sha256=<hex>
 *          Idempotency-Key (opcional)
 * Body: JSON crudo (la firma se calcula sobre el texto exacto).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "GC-IMP-050: método no permitido" }, 405);

  const inicio = Date.now();
  const raw = await req.text();
  const firma = req.headers.get("x-gc-signature") ?? req.headers.get("x-signature") ?? "";
  const idem = req.headers.get("idempotency-key") ?? req.headers.get("x-idempotency-key");
  const tenantHeader = req.headers.get("x-gc-tenant-id") ?? "";
  const codigoHeader = req.headers.get("x-gc-tenant") ?? "";

  if (!firma) return json({ error: "GC-IMP-010: falta X-GC-Signature" }, 401);
  if (!raw) return json({ error: "GC-IMP-012: cuerpo vacío" }, 400);

  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    return json({ error: "GC-IMP-017: JSON inválido" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  let tenantId = tenantHeader;
  if (!tenantId && codigoHeader) {
    const { data } = await admin.from("tenant").select("id").eq("codigo", codigoHeader).maybeSingle();
    tenantId = (data as { id?: string } | null)?.id ?? "";
  }
  if (!tenantId && typeof payload.tenant_id === "string") {
    tenantId = payload.tenant_id;
  }
  if (!tenantId) return json({ error: "GC-IMP-015: tenant no identificado" }, 400);

  const tipo = String(
    req.headers.get("x-gc-event") ?? payload.tipo ?? payload.event ?? "persona.upsert",
  );
  const origen = String(payload.origen ?? payload.source ?? "webhook");

  const { data, error } = await admin.rpc("integracion_recibir", {
    p_tenant_id: tenantId,
    p_origen: origen,
    p_tipo: tipo,
    p_payload: payload,
    p_cuerpo: raw,
    p_firma: firma,
    p_idempotency_key: idem,
  });

  if (error) {
    const msg = error.message ?? "GC-IMP-018: no se pudo encolar";
    const status = msg.includes("GC-IMP-010") ? 401 : msg.includes("GC-IMP-011") ? 403 : 400;
    return json({ error: msg }, status);
  }

  const res = data as { error?: string; estado?: string; id?: number } | null;
  if (res?.error?.startsWith("GC-IMP-010")) {
    return json(res, 401);
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    funcion: "webhook-tenant",
    tenant_id: tenantId,
    tipo,
    duracion_ms: Date.now() - inicio,
    resultado: res?.estado ?? "ok",
  }));

  const status = res?.estado === "procesado" ? 200 : 202;
  return json(res ?? { estado: "pendiente" }, status);
});
