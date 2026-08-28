/**
 * Edge Function: importer
 * CSV (o JSON de filas) de personas / cuentas / catálogos → RPC admin_importar_*.
 *
 * POST JSON { tipo, tenant_id, filas[] }
 * POST multipart: file + tipo + tenant_id
 * Auth: JWT (verify_jwt). Admin de empresa o plataforma.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { esXlsx, parseCsv } from "../_shared/csv.ts";

const TIPOS = new Set(["personas", "cuentas", "catalogos"]);
const RPC: Record<string, string> = {
  personas: "admin_importar_personas",
  cuentas: "admin_importar_cuentas",
  catalogos: "admin_importar_catalogos",
};
const ARG: Record<string, string> = {
  personas: "p_personas",
  cuentas: "p_cuentas",
  catalogos: "p_filas",
};
const MAX_FILAS = 5000;
const LOTE = 500;

function filasDesdeCsv(tipo: string, rows: Record<string, string>[]): Record<string, unknown>[] {
  if (tipo === "catalogos") {
    return rows.map((r) => ({
      tipo: r.tipo,
      nombre: r.nombre,
      codigo: r.codigo,
      actividad: r.actividad,
      cantidad: r.cantidad,
      activo: r.activo,
    }));
  }
  return rows as unknown as Record<string, unknown>[];
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "GC-IMP-050: método no permitido" }, 405);

  const inicio = Date.now();
  const auth = req.headers.get("authorization");
  if (!auth) return json({ error: "GC-IMP-051: autenticación requerida" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let tipo = "";
    let tenantId = "";
    let filas: Record<string, unknown>[] = [];
    let archivoNombre: string | null = null;
    let archivoBytes: Uint8Array | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      tipo = String(form.get("tipo") ?? "").toLowerCase();
      tenantId = String(form.get("tenant_id") ?? "");
      const file = form.get("file") ?? form.get("archivo");
      if (!(file instanceof File)) {
        return json({ error: "GC-IMP-013: se requiere archivo CSV" }, 400);
      }
      archivoNombre = file.name;
      const buf = new Uint8Array(await file.arrayBuffer());
      archivoBytes = buf;
      if (esXlsx(buf)) {
        return json({ error: "GC-IMP-002: exporte el Excel a CSV e inténtelo de nuevo" }, 400);
      }
      const text = new TextDecoder("utf-8").decode(buf);
      filas = filasDesdeCsv(tipo, parseCsv(text));
    } else {
      const body = await req.json();
      tipo = String(body?.tipo ?? "").toLowerCase();
      tenantId = String(body?.tenant_id ?? "");
      const raw = body?.filas ?? body?.personas ?? body?.cuentas;
      if (!Array.isArray(raw)) {
        return json({ error: "GC-IMP-001: se espera filas[] o un CSV" }, 400);
      }
      filas = raw as Record<string, unknown>[];
    }

    if (!TIPOS.has(tipo)) {
      return json({ error: "GC-IMP-014: tipo debe ser personas, cuentas o catalogos" }, 400);
    }
    if (!tenantId) {
      return json({ error: "GC-IMP-015: tenant_id requerido" }, 400);
    }
    if (filas.length === 0) {
      return json({ error: "GC-IMP-016: el archivo no tiene filas" }, 400);
    }
    if (filas.length > MAX_FILAS) {
      return json({ error: `GC-IMP-003: máximo ${MAX_FILAS} filas por carga` }, 400);
    }

    const { data: userData, error: errUser } = await userClient.auth.getUser();
    if (errUser || !userData.user) return json({ error: "GC-IMP-051: autenticación requerida" }, 401);

    if (archivoBytes && archivoNombre) {
      const uid = crypto.randomUUID();
      const path = `${tenantId}/${new Date().toISOString().slice(0, 10)}/${uid}.csv`;
      await admin.storage.from("importes").upload(path, archivoBytes, {
        contentType: "text/csv",
        upsert: true,
      });
    }

    let insertados = 0;
    let actualizados = 0;
    const errores: unknown[] = [];
    const rpc = RPC[tipo];
    const arg = ARG[tipo];

    for (let i = 0; i < filas.length; i += LOTE) {
      const chunk = filas.slice(i, i + LOTE);
      const { data, error } = await userClient.rpc(rpc, {
        p_tenant_id: tenantId,
        [arg]: chunk,
      });
      if (error) {
        return json({ error: error.message }, error.message.startsWith("GC-AUTH") ? 403 : 400);
      }
      const r = data as { insertados?: number; actualizados?: number; errores?: unknown[] } | null;
      insertados += r?.insertados ?? 0;
      actualizados += r?.actualizados ?? 0;
      if (Array.isArray(r?.errores)) {
        for (const e of r.errores) {
          if (e && typeof e === "object" && "fila" in e) {
            errores.push({ ...(e as Record<string, unknown>), fila: Number((e as { fila: number }).fila) + i });
          } else {
            errores.push(e);
          }
        }
      }
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      funcion: "importer",
      tenant_id: tenantId,
      tipo,
      duracion_ms: Date.now() - inicio,
      resultado: "ok",
      insertados,
      actualizados,
      errores: errores.length,
    }));

    const status = filas.length > 2000 ? 202 : 200;
    return json({ tipo, insertados, actualizados, errores, total: filas.length }, status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "GC-IMP-017: payload inválido";
    return json({ error: msg.startsWith("GC-") ? msg : "GC-IMP-017: payload inválido" }, 400);
  }
});
