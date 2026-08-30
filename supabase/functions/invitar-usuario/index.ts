/**
 * Edge Function: invitar-usuario
 * Crea el auth user (service_role) y lo da de alta en public.usuario
 * vía admin_usuario_invitar (permiso del JWT del invitador).
 *
 * POST { tenant_id, email, nombre, rol, password, jefe_id?, zona_id? }
 * Auth: JWT (verify_jwt). Superadmin de plataforma o admin del tenant.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";

function generarPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }Aa1!`;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return json({ error: "GC-AUTH-010: método no permitido" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "GC-AUTH-001: sin autorización" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, service);

  try {
    const body = await req.json() as {
      tenant_id?: string;
      email?: string;
      nombre?: string;
      rol?: string;
      password?: string;
      jefe_id?: string | null;
      zona_id?: number | null;
    };

    const email = body.email?.trim().toLowerCase();
    const tenantId = body.tenant_id;
    const rol = body.rol ?? "asesor";
    if (!email || !tenantId) {
      return json({ error: "GC-AUTH-011: tenant_id y email requeridos" }, 400);
    }

    const generado = !body.password || body.password.length < 8;
    const password = generado ? generarPassword() : body.password!;

    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre: body.nombre ?? email },
      });

    if (createErr && !/already|exists|registered/i.test(createErr.message)) {
      return json({ error: `GC-AUTH-003: ${createErr.message}` }, 400);
    }

    const { data: invited, error: invErr } = await userClient.rpc(
      "admin_usuario_invitar",
      {
        p_tenant_id: tenantId,
        p_email: email,
        p_rol: rol,
        p_nombre: body.nombre ?? email,
        p_jefe_id: body.jefe_id ?? null,
        p_zona_id: body.zona_id ?? null,
      },
    );

    if (invErr) {
      return json({ error: invErr.message }, 400);
    }

    return json({
      id: invited ?? created?.user?.id,
      email,
      password_temporal: generado ? password : undefined,
    });
  } catch (_e) {
    return json({ error: "GC-AUTH-013: payload inválido" }, 400);
  }
});
