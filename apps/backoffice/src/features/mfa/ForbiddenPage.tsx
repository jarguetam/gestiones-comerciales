export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-spec="P-01">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted">
          Esta cuenta no es de plataforma. Pedí acceso a un owner (GC-AUTH-001).
        </p>
      </div>
    </div>
  )
}
