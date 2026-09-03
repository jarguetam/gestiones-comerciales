export type RequestContext = { requestId: string };

export type EdgeLogFields = RequestContext & {
  tenantId: string | null;
  userId: string | null;
  fn: string;
  outcome: "ok" | "error";
};

const cache = new WeakMap<Request, RequestContext>();

export function readRequestContext(req: Request): RequestContext {
  const hit = cache.get(req);
  if (hit) return hit;
  const header = req.headers.get("x-request-id");
  const requestId = header && header.length <= 64 && header.trim()
    ? header.trim()
    : crypto.randomUUID();
  const ctx = { requestId };
  cache.set(req, ctx);
  return ctx;
}

export function toEdgeLog(
  ctx: RequestContext,
  claims: { tenant_id?: string; sub?: string } | undefined,
  fn: string,
  outcome: "ok" | "error",
): EdgeLogFields {
  return {
    requestId: ctx.requestId,
    tenantId: claims?.tenant_id ?? null,
    userId: claims?.sub ?? null,
    fn,
    outcome,
  };
}

export function logEdge(
  fields: EdgeLogFields,
  extra?: Record<string, unknown>,
) {
  const { requestId, tenantId, userId, fn, outcome } = fields;
  const payload: Record<string, unknown> = {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    fn,
    outcome,
  };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (/authorization|bearer|password|secret|email|token/i.test(k)) continue;
      payload[k] = v;
    }
  }
  console.log(JSON.stringify(payload));
}

export function serveEdge(
  fn: string,
  handler: (req: Request, ctx: RequestContext) => Promise<Response> | Response,
): void {
  Deno.serve(async (req) => {
    const ctx = readRequestContext(req);
    try {
      const res = await handler(req, ctx);
      const outcome: "ok" | "error" = res.status >= 400 ? "error" : "ok";
      logEdge(toEdgeLog(ctx, undefined, fn, outcome), { status: res.status });
      const headers = new Headers(res.headers);
      headers.set("x-request-id", ctx.requestId);
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      logEdge(toEdgeLog(ctx, undefined, fn, "error"));
      throw err;
    }
  });
}
