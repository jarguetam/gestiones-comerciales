/**
 * Edge Function: invitar-usuario
 * Autoriza a un superadmin de plataforma con AAL2, crea el usuario Auth y
 * después da de alta su perfil mediante admin_usuario_invitar.
 *
 * POST { tenant_id, email, nombre, rol, password, jefe_id?, zona_id? }
 * Auth: JWT verificado. Solo usuario_plataforma.es_superadmin con AAL2.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import {
  invitarUsuario,
  type InviteDeps,
  InviteError,
  requireActorFromBearer,
} from "./invitar.ts";

type InviteRpcClient = {
  rpc: (
    name: "admin_usuario_invitar",
    args: {
      p_tenant_id: string;
      p_email: string;
      p_rol: string;
      p_jefe_id: string | null;
      p_nombre: string;
      p_zona_id: number | null;
    },
  ) => Promise<{ error: { message: string } | null }>;
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);
  let userClient: ReturnType<typeof createClient> | undefined;

  const deps: InviteDeps = {
    requireActor: async (request) => {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader) {
        throw new InviteError("GC-AUTH-001: sin autorización", 401);
      }

      userClient = createClient(url, anon, {
        global: { headers: { Authorization: authHeader } },
      });
      return await requireActorFromBearer(request, {
        getUser: (jwt) => userClient!.auth.getUser(jwt),
        getAuthenticatorAssuranceLevel: (jwt) =>
          userClient!.auth.mfa.getAuthenticatorAssuranceLevel(jwt),
      });
    },
    isPlatformSuperadmin: async (userId) => {
      const { data, error } = await admin
        .from("usuario_plataforma")
        .select("id")
        .eq("id", userId)
        .eq("es_superadmin", true)
        .eq("activo", true)
        .maybeSingle();
      if (error) {
        throw new InviteError(
          "GC-AUTH-012: no se pudo verificar la autorización",
          500,
        );
      }
      return data !== null;
    },
    createUser: async ({ email, password, metadata }) => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error || !data.user) {
        throw new InviteError(
          "GC-AUTH-012: no se pudo crear el usuario de autenticación",
          500,
        );
      }
      return { id: data.user.id };
    },
    inviteProfile: async ({
      tenantId,
      email,
      rol,
      nombre,
      jefeId,
      zonaId,
    }) => {
      if (!userClient) {
        throw new InviteError("GC-AUTH-001: sin autorización", 401);
      }
      const { error } = await (userClient as unknown as InviteRpcClient).rpc(
        "admin_usuario_invitar",
        {
          p_tenant_id: tenantId,
          p_email: email,
          p_rol: rol,
          p_jefe_id: jefeId,
          p_nombre: nombre,
          p_zona_id: zonaId,
        },
      );
      if (error) throw new Error(error.message);
    },
    deleteUser: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        throw new InviteError(
          "GC-AUTH-012: no se pudo revertir el usuario de autenticación",
          500,
        );
      }
    },
    log: (entry) => {
      const line = JSON.stringify(entry);
      if (entry.outcome === "error") console.error(line);
      else console.log(line);
    },
  };

  const response = await invitarUsuario(deps, req);
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
});
