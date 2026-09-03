/**
 * Edge Function: pdf-solicitud
 * Al firmar una solicitud: valida PNG (GC-SOLI-001), sube la firma a Storage,
 * genera un PDF simple con branding del tenant, lo sube y actualiza pdf_ruta.
 *
 * POST { solicitud_id, firma_base64 }
 * Auth: JWT del usuario (verify_jwt).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import { registrarInvocacion } from "../_shared/invocacion.ts";
import { serveEdge } from "../_shared/request_context.ts";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function esPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

function decodeFirma(raw: string): Uint8Array {
  const b64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  const bin = atob(b64.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function simplePdf(lineas: string[]): Uint8Array {
  const contenido = [
    "BT",
    "/F1 16 Tf",
    "50 740 Td",
    ...lineas.flatMap((l, i) =>
      i === 0 ? [`(${pdfEscape(l)}) Tj`] : ["0 -22 Td", `(${pdfEscape(l)}) Tj`]
    ),
    "ET",
  ].join("\n");
  const objs = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${contenido.length} >> stream\n${contenido}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let offset = 9;
  const xref = ["xref", "0 6", "0000000000 65535 f "];
  const bodyParts = ["%PDF-1.4\n"];
  for (const o of objs) {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    bodyParts.push(o);
    offset += o.length;
  }
  const xrefStart = offset;
  const tail = xref.join("\n") +
    "\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n" +
    xrefStart +
    "\n%%EOF\n";
  bodyParts.push(tail);
  return new TextEncoder().encode(bodyParts.join(""));
}

serveEdge("pdf-solicitud", async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return json({ error: "GC-SOLI-010: método no permitido" }, 405);
  }

  const inicio = Date.now();
  const auth = req.headers.get("authorization");
  if (!auth) {
    return json({ error: "GC-SOLI-011: autenticación requerida" }, 401);
  }

  try {
    const body = await req.json();
    const solicitudId = Number(body?.solicitud_id);
    const firmaRaw = String(body?.firma_base64 ?? body?.firma ?? "");
    if (!solicitudId || !firmaRaw) {
      return json({
        error: "GC-SOLI-012: se requiere solicitud_id y firma_base64",
      }, 400);
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeFirma(firmaRaw);
    } catch {
      return json({
        error: "GC-SOLI-001: la firma no es una imagen PNG válida",
      }, 400);
    }
    if (!esPng(bytes)) {
      return json({
        error: "GC-SOLI-001: la firma no es una imagen PNG válida",
      }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });

    const { data: sol, error: errSol } = await userClient
      .from("solicitud")
      .select("id, tenant_id, descripcion, monto, persona_id")
      .eq("id", solicitudId)
      .maybeSingle();
    if (errSol || !sol) {
      return json({
        error: "GC-SOLI-001: solicitud no encontrada o sin acceso",
      }, 404);
    }

    const { data: tenant } = await userClient
      .from("tenant")
      .select("nombre, branding")
      .eq("id", sol.tenant_id)
      .maybeSingle();

    const uid = crypto.randomUUID();
    const firmaPath = `${sol.tenant_id}/${solicitudId}/${uid}.png`;
    const pdfPath = `${sol.tenant_id}/${solicitudId}/${uid}.pdf`;

    const { error: errUpFirma } = await userClient.storage.from("firmas")
      .upload(firmaPath, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (errUpFirma) {
      return json({ error: "GC-SOLI-013: no se pudo guardar la firma" }, 500);
    }

    const marca = (tenant?.branding as { nombre?: string } | null)?.nombre ??
      tenant?.nombre ?? "Gestiones Comerciales";
    const pdf = simplePdf([
      marca,
      `Solicitud #${solicitudId}`,
      sol.descripcion ?? "",
      sol.monto != null ? `Monto: ${sol.monto}` : "",
      `Firmado: ${new Date().toISOString().slice(0, 10)}`,
    ].filter(Boolean));

    const { error: errUpPdf } = await userClient.storage.from("documentos")
      .upload(pdfPath, pdf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (errUpPdf) {
      return json({ error: "GC-SOLI-014: no se pudo guardar el PDF" }, 500);
    }

    const { data: userData } = await userClient.auth.getUser();
    const firmadoPor = userData.user?.id;
    if (!firmadoPor) {
      return json({ error: "GC-SOLI-011: autenticación requerida" }, 401);
    }

    const { error: errFirma } = await userClient.from("solicitud_firma").upsert(
      {
        solicitud_id: solicitudId,
        firma_ruta: `firmas/${firmaPath}`,
        pdf_ruta: `documentos/${pdfPath}`,
        firmado_por: firmadoPor,
        firmado_en: new Date().toISOString(),
      },
    );
    if (errFirma) {
      return json({ error: "GC-SOLI-001: no se pudo registrar la firma" }, 403);
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      funcion: "pdf-solicitud",
      tenant_id: sol.tenant_id,
      duracion_ms: Date.now() - inicio,
      resultado: "ok",
    }));

    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (service) {
      await registrarInvocacion(createClient(url, service), {
        funcion: "pdf-solicitud",
        ok: true,
        duracionMs: Date.now() - inicio,
        tenantId: sol.tenant_id,
      });
    }

    return json({
      solicitud_id: solicitudId,
      firma_ruta: `firmas/${firmaPath}`,
      pdf_ruta: `documentos/${pdfPath}`,
    });
  } catch (_e) {
    return json({ error: "GC-SOLI-015: payload inválido" }, 400);
  }
});
