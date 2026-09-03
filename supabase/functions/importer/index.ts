/**
 * Edge Function: importer
 * CSV (o JSON de filas) de personas / cuentas / catálogos → RPC admin_importar_*.
 *
 * POST JSON { tipo, tenant_id, filas[] }
 * POST multipart: file + tipo + tenant_id
 * Auth: JWT verificado. Solo usuario_plataforma.es_superadmin con AAL2.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { registrarInvocacion } from "../_shared/invocacion.ts";
import { readRequestContext, serveEdge } from "../_shared/request_context.ts";
import {
  importar,
  type ImporterDeps,
  ImporterError,
  requireImporterActorFromBearer,
} from "./importer.ts";

type ImporterRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: {
      insertados?: number;
      actualizados?: number;
      errores?: unknown[];
    } | null;
    error: { message: string } | null;
  }>;
};

serveEdge("importer", async (req) => {
  const _ctx = readRequestContext(req);
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);
  let userClient: ReturnType<typeof createClient> | undefined;

  const deps: ImporterDeps = {
    requireActor: (request) =>
      requireImporterActorFromBearer(request, {
        getUser: (bearer) => {
          userClient = createClient(url, anon, {
            global: { headers: { Authorization: `Bearer ${bearer}` } },
          });
          return userClient.auth.getUser(bearer);
        },
        getAuthenticatorAssuranceLevel: (bearer) => {
          if (!userClient) {
            throw new ImporterError(
              "GC-IMP-051: autenticación requerida",
            );
          }
          return userClient.auth.mfa.getAuthenticatorAssuranceLevel(bearer);
        },
      }),
    isPlatformSuperadmin: async (userId) => {
      const { data, error } = await admin
        .from("usuario_plataforma")
        .select("id")
        .eq("id", userId)
        .eq("es_superadmin", true)
        .eq("activo", true)
        .maybeSingle();
      if (error) {
        throw new ImporterError(
          "GC-AUTH-012: no se pudo verificar la autorización",
        );
      }
      return data !== null;
    },
    isTenantActive: async (tenantId) => {
      const { data, error } = await admin
        .from("tenant")
        .select("id")
        .eq("id", tenantId)
        .eq("activo", true)
        .maybeSingle();
      if (error) {
        throw new ImporterError(
          "GC-AUTH-012: no se pudo verificar el tenant",
        );
      }
      return data !== null;
    },
    uploadFile: async (path, bytes) => {
      const { error } = await admin.storage.from("importes").upload(
        path,
        bytes,
        {
          contentType: "text/csv",
          upsert: true,
        },
      );
      if (error) {
        throw new ImporterError(
          "GC-IMP-018: no se pudo guardar el archivo de importación",
        );
      }
    },
    removeFile: async (path) => {
      const { error } = await admin.storage.from("importes").remove([path]);
      if (error) {
        throw new ImporterError(
          "GC-IMP-018: no se pudo eliminar el archivo de importación",
        );
      }
    },
    importBatch: async ({ rpc, arg, tenantId, rows }) => {
      if (!userClient) {
        throw new ImporterError(
          "GC-IMP-051: autenticación requerida",
        );
      }
      const { data, error } = await (userClient as unknown as ImporterRpcClient)
        .rpc(rpc, {
          p_tenant_id: tenantId,
          [arg]: rows,
        });
      if (error) throw new Error(error.message);
      return data;
    },
    recordInvocation: async ({ ok, durationMs, tenantId }) => {
      await registrarInvocacion(admin, {
        funcion: "importer",
        ok,
        duracionMs: durationMs,
        tenantId,
      });
    },
    log: (entry) => {
      const line = JSON.stringify(entry);
      if (entry.outcome === "error") console.error(line);
      else console.log(line);
    },
  };

  const response = await importar(deps, req);
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
});
