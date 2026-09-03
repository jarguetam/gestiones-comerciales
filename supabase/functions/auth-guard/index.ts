import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AuthGuardDeps,
  handleAuthGuard,
  resolveAllowedOrigins,
} from "./auth_guard.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const allowedOrigins = resolveAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

function serviceClient() {
  return createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve((req) => {
  const authClient = createClient(url, anon);
  const deps: AuthGuardDeps = {
    signIn: async ({ email, password }) => {
      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) {
        return { session: null, error };
      }
      return {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        error: null,
      };
    },
    getAuthenticatorAssuranceLevel: async () => {
      const { data, error } = await authClient.auth.mfa
        .getAuthenticatorAssuranceLevel();
      return { data, error };
    },
    countRecentFails: async (ip, sinceIso) => {
      const { count, error } = await serviceClient()
        .from("auth_evento")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .in("outcome", ["fail", "blocked"])
        .gte("creado_en", sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
    recordEvent: async ({ ip, emailHash, outcome, requestId }) => {
      const { error } = await serviceClient().from("auth_evento").insert({
        ip,
        email_hash: emailHash,
        outcome,
        request_id: requestId,
      });
      if (error) throw error;
    },
    log: (entry) => {
      console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
    },
  };

  return handleAuthGuard(deps, req, allowedOrigins);
});
