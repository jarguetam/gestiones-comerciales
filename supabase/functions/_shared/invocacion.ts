type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => unknown;
};

/** Best-effort: no bloquea la respuesta de la Edge Function. */
export async function registrarInvocacion(
  admin: RpcClient,
  args: {
    funcion: string;
    ok: boolean;
    error?: string | null;
    duracionMs: number;
    tenantId?: string | null;
  },
): Promise<void> {
  try {
    await Promise.resolve(
      admin.rpc("registrar_edge_invocacion", {
        p_funcion: args.funcion,
        p_ok: args.ok,
        p_error: args.error ?? null,
        p_duracion_ms: args.duracionMs,
        p_tenant_id: args.tenantId ?? null,
      }),
    );
  } catch {
    /* ignore */
  }
}
