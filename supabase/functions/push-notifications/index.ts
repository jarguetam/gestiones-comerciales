import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import {
  enviarFcm,
  getAccessToken,
  getServiceAccount,
} from "../_shared/firebase.ts";
import { esLlamadorServiceRole } from "./push_authz.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "GC-PUSH-010: método no permitido" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!esLlamadorServiceRole(req, serviceKey)) {
    return json(
      { error: "GC-PUSH-012: solo service_role puede enviar push" },
      403,
    );
  }

  const inicio = Date.now();
  try {
    const { tenant_id, usuario_ids, titulo, cuerpo, datos } = await req.json();
    if (
      !tenant_id || !Array.isArray(usuario_ids) || usuario_ids.length === 0 ||
      !titulo || !cuerpo
    ) {
      return json({
        error:
          "GC-PUSH-011: tenant_id, usuario_ids[], titulo y cuerpo son requeridos",
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    // Dispositivos activos de los usuarios objetivo (validando tenant vía join)
    const { data: dispositivos, error: errDisp } = await supabase
      .from("dispositivo")
      .select("id, usuario_id, token_fcm, usuario!inner(tenant_id)")
      .eq("usuario.tenant_id", tenant_id)
      .in("usuario_id", usuario_ids)
      .eq("activo", true);

    if (errDisp) {
      return json(
        { error: "GC-PUSH-013: no se pudieron leer dispositivos" },
        500,
      );
    }

    const conDispositivo = new Set(
      (dispositivos ?? []).map((d) => d.usuario_id),
    );
    const sinDispositivo: string[] = usuario_ids.filter((u: string) =>
      !conDispositivo.has(u)
    );

    let enviados = 0;
    let fallidos = 0;
    const usuariosNotificados = new Set<string>();

    const sa = getServiceAccount();
    if (sa && (dispositivos ?? []).length > 0) {
      const accessToken = await getAccessToken(sa);
      const datosStr: Record<string, string> = {};
      for (const [k, v] of Object.entries(datos ?? {})) datosStr[k] = String(v);

      for (const disp of dispositivos ?? []) {
        const r = await enviarFcm(
          sa,
          accessToken,
          disp.token_fcm,
          titulo,
          cuerpo,
          datosStr,
        );
        if (r.ok) {
          enviados++;
          usuariosNotificados.add(disp.usuario_id);
        } else {
          fallidos++;
          if (r.invalido) {
            await supabase.from("dispositivo").update({ activo: false }).eq(
              "id",
              disp.id,
            );
          }
        }
      }
    }

    // Degradación a in-app: usuarios sin dispositivo o cuyo push falló (o sin FCM configurado)
    const paraInApp = [
      ...sinDispositivo,
      ...usuario_ids.filter((u: string) =>
        conDispositivo.has(u) && !usuariosNotificados.has(u)
      ),
    ];
    let inApp = 0;
    if (paraInApp.length > 0) {
      const filas = [...new Set(paraInApp)].map((u) => ({
        tenant_id,
        usuario_id: u,
        titulo,
        cuerpo,
        datos: datos ?? {},
        canal: "in_app",
      }));
      const { error: errNotif, count } = await supabase
        .from("notificacion")
        .insert(filas, { count: "exact" });
      if (errNotif) {
        return json({ error: "GC-PUSH-014: no se pudo encolar in-app" }, 500);
      }
      inApp = count ?? filas.length;
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      tenant_id,
      funcion: "push-notifications",
      duracion_ms: Date.now() - inicio,
      resultado: { enviados, fallidos, in_app: inApp, fcm_configurado: !!sa },
    }));

    return json({ enviados, fallidos, in_app: inApp, fcm_configurado: !!sa });
  } catch (_e) {
    return json({ error: "GC-PUSH-015: payload inválido" }, 400);
  }
});
