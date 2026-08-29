import type { ReactNode } from 'react'

/** Encabezado de pantalla. El id de spec (P-xx) va en data-spec, nunca como eyebrow visible. */
export function PageHeader({
  spec,
  title,
  description,
  actions,
}: {
  spec?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3" data-spec={spec}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export const PAGE = 'w-full space-y-5 p-4 md:p-6'
