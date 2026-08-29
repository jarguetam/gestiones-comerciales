import type { ReactNode } from 'react'

/** Encabezado de pantalla. El id de spec (W-03) va en data-spec, nunca como eyebrow visible. */
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
      <div>
        <h2 className="font-serif text-3xl text-ink">{title}</h2>
        {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export const PAGE = 'mx-auto w-full max-w-6xl space-y-4'
