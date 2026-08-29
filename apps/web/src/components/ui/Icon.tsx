import type { SVGProps } from 'react'
import { cn } from '../../lib/cn'

export type IconName =
  | 'hoy'
  | 'jornada'
  | 'cartera'
  | 'crm'
  | 'mas'
  | 'salir'
  | 'campana'
  | 'plus'
  | 'vacio'
  | 'checkin'

const stroke: Pick<SVGProps<SVGSVGElement>, 'fill' | 'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ className, size, children, ...rest }: SVGProps<SVGSVGElement> & { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...stroke}
      {...rest}
    >
      {children}
    </svg>
  )
}

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  switch (name) {
    case 'hoy':
      return (
        <Svg size={size} className={className}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </Svg>
      )
    case 'jornada':
      return (
        <Svg size={size} className={className}>
          <rect x="5" y="4.5" width="14" height="16" rx="2" />
          <path d="M8 3v3M16 3v3M5 10h14" />
        </Svg>
      )
    case 'cartera':
      return (
        <Svg size={size} className={className}>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 19.5v-1.2A3.8 3.8 0 0 1 7.8 14.5h2.4" />
          <circle cx="16.5" cy="9.5" r="2.2" />
          <path d="M20.5 19.5v-1A3 3 0 0 0 17.5 15.5h-.4" />
        </Svg>
      )
    case 'crm':
      return (
        <Svg size={size} className={className}>
          <rect x="3.5" y="4" width="5" height="16" rx="1" />
          <rect x="9.5" y="8" width="5" height="12" rx="1" />
          <rect x="15.5" y="6" width="5" height="14" rx="1" />
        </Svg>
      )
    case 'mas':
      return (
        <Svg size={size} className={className}>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </Svg>
      )
    case 'salir':
      return (
        <Svg size={size} className={className}>
          <path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </Svg>
      )
    case 'campana':
      return (
        <Svg size={size} className={className}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </Svg>
      )
    case 'plus':
      return (
        <Svg size={size} className={className}>
          <path d="M12 5v14M5 12h14" />
        </Svg>
      )
    case 'vacio':
      return (
        <Svg size={size} className={className}>
          <path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </Svg>
      )
    case 'checkin':
      return (
        <Svg size={size} className={className}>
          <path d="M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21Z" />
          <circle cx="12" cy="10" r="2.2" />
        </Svg>
      )
  }
}
