export function esLlamadorServiceRole(req: Request, serviceRoleKey: string): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === serviceRoleKey;
}
