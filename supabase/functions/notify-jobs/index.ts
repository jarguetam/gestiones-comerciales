/**
 * Edge Function: notify-jobs
 * Orquestador de jobs genéricos por tenant activo (spec backend §4.3 y §7).
 * Lo dispara pg_cron vía pg_net con un secret compartido (verify_jwt = false).
 *
 * POST { job?: "recordatorio_agenda" }   (default: recordatorio_agenda)
 * Header requerido: x-notify-secret == NOTIFY_JOBS_SECRET
 * → 200 { job, tenants_procesados, notificaciones }
 *
 * Jobs:
 *  - recordatorio_agenda: push a cada asesor con sus visitas programadas de
 *    mañana (hora Guatemala). Degrada a in-app si el asesor no tiene dispositivo.
 *  - recordatorio_depositos: RPC SQL, solo tenants con módulo depositos.
 *  - recordatorio_kilometraje: RPC SQL, último día del mes (guarda en SQL).
 *  - snapshot_cuentas: RPC SQL, corte diario de cuenta_saldo (módulo creditos).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import { registrarInvocacion } from "../_shared/invocacion.ts";
import { readRequestContext, serveEdge } from "../_shared/request_context.ts";

const GT_OFFSET_MS = -6 * 60 * 60_000;

function fechaGT(offsetDias: number): string {
  const d = new Date(Date.now() + GT_OFFSET_MS + offsetDias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

serveEdge("notify-jobs", async (req) => {
  const _ctx = readRequestContext(req);
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "GC-JOBS-010: método no permitido" }, 405);
  }

  const inicio = Date.now();

  // Secret compartido con pg_cron (spec: notify-jobs sin JWT, autenticado por secret)
  const secret = req.headers.get("x-notify-secret");
  const esperado = Deno.env.get("NOTIFY_JOBS_SECRET");
  if (!esperado || secret !== esperado) {
    return json({ error: "GC-JOBS-011: no autorizado" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const job = body?.job ?? "recordatorio_agenda";
    const jobsSql: string[] = [
      "recordatorio_depositos",
      "recordatorio_kilometraje",
      "snapshot_cuentas",
    ];
    if (job !== "recordatorio_agenda" && !jobsSql.includes(job)) {
      return json({ error: `GC-JOBS-012: job desconocido '${job}'` }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (jobsSql.includes(job)) {
      const { data, error } = await supabase.rpc(job);
      if (error) return json({ error: `GC-JOBS-013: ${error.message}` }, 500);
      return json({ job, resultado: data, tenants_procesados: null });
    }

    const { data: tenants, error: errTenants } = await supabase
      .from("tenant")
      .select("id, nombre")
      .eq("activo", true);
    if (errTenants) {
      return json({ error: "GC-JOBS-013: no se pudieron leer tenants" }, 500);
    }

    const maniana = fechaGT(1);
    let notificaciones = 0;
    const detalle: Record<string, number> = {};

    for (const tenant of tenants ?? []) {
      // Visitas de mañana agrupadas por asesor
      const { data: visitas, error: errV } = await supabase
        .from("visita")
        .select("usuario_id")
        .eq("tenant_id", tenant.id)
        .eq("fecha_visita", maniana)
        .eq("estado", "programada");
      if (errV) continue;

      const porAsesor = new Map<string, number>();
      for (const v of visitas ?? []) {
        porAsesor.set(v.usuario_id, (porAsesor.get(v.usuario_id) ?? 0) + 1);
      }
      if (porAsesor.size === 0) continue;

      // Orquesta push-notifications (spec §7) con service_role
      const res = await fetch(
        `${supabaseUrl}/functions/v1/push-notifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id: tenant.id,
            usuario_ids: [...porAsesor.keys()],
            titulo: "Agenda de mañana",
            cuerpo: `Tienes ${
              [...porAsesor.values()].reduce((a, b) => a + b, 0)
            } visita(s) programada(s) para mañana ${maniana}.`,
            datos: { tipo: "recordatorio_agenda", fecha: maniana },
          }),
        },
      );
      if (res.ok) {
        notificaciones += porAsesor.size;
        detalle[tenant.nombre] = porAsesor.size;
      }
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      funcion: "notify-jobs",
      duracion_ms: Date.now() - inicio,
      resultado: {
        job,
        tenants_procesados: (tenants ?? []).length,
        notificaciones,
      },
    }));

    await registrarInvocacion(supabase, {
      funcion: "notify-jobs",
      ok: true,
      duracionMs: Date.now() - inicio,
    });
    return json({
      job,
      fecha_objetivo: maniana,
      tenants_procesados: (tenants ?? []).length,
      notificaciones,
      detalle,
    });
  } catch (_e) {
    return json({ error: "GC-JOBS-014: payload inválido" }, 400);
  }
});
