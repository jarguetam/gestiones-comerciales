/**
 * Edge Function: rastreo-ingesta
 * Recibe el lote de puntos GPS de la app móvil (spec backend §4.3), valida:
 *   - ventana horaria del tenant (config_rastreo por día) → fuera de ventana no se inserta
 *   - precision_max_m del tenant → descarta lecturas imprecisas (regla GC-RAS-001)
 * y delega el insert idempotente al RPC `rastreo_ingesta` (auditoría incluida).
 *
 * POST { puntos: [{ latitud, longitud, precision_m?, velocidad_kmh?, bateria?, registrado_en }] }
 * (se aceptan aliases lat/lng; bateria se recibe pero no se persiste en v1)
 * → 200 { recibidos, insertados, descartados_precision, descartados_ventana, ventana_activa }
 *
 * Auth: JWT del asesor (verify_jwt). Todo corre con el contexto del usuario (RLS).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import { readRequestContext, serveEdge } from "../_shared/request_context.ts";

// Guatemala no tiene DST: offset fijo UTC-6 para interpretar "hoy/hora" del tenant
const GT_OFFSET_MS = -6 * 60 * 60_000;

interface Punto {
  latitud: number;
  longitud: number;
  precision_m?: number | null;
  velocidad_kmh?: number | null;
  registrado_en: string;
}

function normalizar(p: Record<string, unknown>): Punto | null {
  const lat = p.latitud ?? p.lat;
  const lng = p.longitud ?? p.lng;
  const cuando = p.registrado_en ?? p.capturado_en;
  if (typeof lat !== "number" || typeof lng !== "number" || !cuando) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    latitud: lat,
    longitud: lng,
    precision_m: (p.precision_m ?? p.precision ?? null) as number | null,
    velocidad_kmh: (p.velocidad_kmh ?? p.velocidad ?? null) as number | null,
    registrado_en: String(cuando),
  };
}

serveEdge("rastreo-ingesta", async (req) => {
  const _ctx = readRequestContext(req);
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "GC-RAS-010: método no permitido" }, 405);
  }

  const inicio = Date.now();
  try {
    const body = await req.json();
    const crudos: Record<string, unknown>[] = Array.isArray(body)
      ? body
      : body?.puntos;
    if (!Array.isArray(crudos) || crudos.length === 0) {
      return json({ error: "GC-RAS-011: se requiere un array de puntos" }, 400);
    }
    if (crudos.length > 500) {
      return json({ error: "GC-RAS-012: máximo 500 puntos por lote" }, 400);
    }

    const puntos = crudos.map(normalizar).filter((p): p is Punto => p !== null);
    if (puntos.length === 0) {
      return json({ error: "GC-RAS-013: ningún punto válido en el lote" }, 400);
    }

    // Cliente con el JWT del usuario: config_rastreo y el RPC respetan RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("authorization")! },
        },
      },
    );

    // Ventana del tenant para "hoy" en Guatemala
    const ahoraGT = new Date(Date.now() + GT_OFFSET_MS);
    const diaSemana = ahoraGT.getUTCDay(); // 0=domingo, igual que config_rastreo
    const horaGT = ahoraGT.toISOString().slice(11, 19); // HH:MM:SS

    const { data: config, error: errCfg } = await supabase
      .from("config_rastreo")
      .select("hora_inicio, hora_fin, precision_max_m")
      .eq("dia_semana", diaSemana)
      .maybeSingle();

    if (errCfg) {
      return json({ error: "GC-RAS-014: no se pudo leer config_rastreo" }, 500);
    }

    const precisionMax = config?.precision_max_m ?? 100;
    const ventanaActiva = config
      ? horaGT >= config.hora_inicio && horaGT <= config.hora_fin
      : true; // sin config del día → no se restringe (día libre del tenant)

    let descartadosPrecision = 0;
    const aceptables: Punto[] = [];
    for (const p of puntos) {
      // GC-RAS-001: lecturas con precisión >= max del tenant se descartan
      if (p.precision_m != null && p.precision_m >= precisionMax) {
        descartadosPrecision++;
      } else {
        aceptables.push(p);
      }
    }

    let insertados = 0;
    let descartadosVentana = 0;
    if (ventanaActiva && aceptables.length > 0) {
      const { data, error } = await supabase.rpc("rastreo_ingesta", {
        p_puntos: aceptables,
      });
      if (error) {
        return json({ error: "GC-RAS-015: no se pudo insertar el lote" }, 500);
      }
      insertados = data ?? 0;
    } else {
      descartadosVentana = aceptables.length;
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      funcion: "rastreo-ingesta",
      duracion_ms: Date.now() - inicio,
      resultado: {
        recibidos: puntos.length,
        insertados,
        descartados_precision: descartadosPrecision,
        descartados_ventana: descartadosVentana,
        ventana_activa: ventanaActiva,
      },
    }));

    return json({
      recibidos: puntos.length,
      insertados,
      descartados_precision: descartadosPrecision,
      descartados_ventana: descartadosVentana,
      ventana_activa: ventanaActiva,
    });
  } catch (_e) {
    return json({ error: "GC-RAS-016: payload inválido" }, 400);
  }
});
