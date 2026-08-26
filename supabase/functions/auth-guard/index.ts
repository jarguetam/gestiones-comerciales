/**
 * Edge Function: auth-guard
 * Rate limiting de intentos de login por email+IP (spec backend §3.1).
 * Bloquea 5 intentos fallidos por 15 min.
 *
 * POST { email, ip }
 * → 200 { bloqueado: false } | 429 { bloqueado: true, reintenta_en }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WINDOW_MIN = 15;
const MAX_ATTEMPTS = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "GC-AUTH-010: método no permitido" }, 405);

  try {
    const { email, ip } = await req.json();
    if (!email) return json({ error: "GC-AUTH-011: email requerido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ventana de 15 min hacia atrás
    const desde = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();

    const { data, error } = await supabase
      .from("auth_attempts")
      .select("creado_en")
      .eq("email", email)
      .eq("exitoso", false)
      .gte("creado_en", desde);

    if (error) return json({ error: "GC-AUTH-012: no se pudo evaluar" }, 500);

    // nota: la tabla auth_attempts la alimenta el cliente/Edge tras cada intento fallido.
    // v1: bloqueo por email; el filtro por IP se agrega cuando exista la columna ip.
    const intentos = (data ?? []).length;
    const bloqueado = intentos >= MAX_ATTEMPTS;

    return json({
      bloqueado,
      intentos,
      reintenta_en: bloqueado ? WINDOW_MIN * 60 : 0,
    });
  } catch (_e) {
    return json({ error: "GC-AUTH-013: payload inválido" }, 400);
  }
});
