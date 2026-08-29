import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { colorPrimario, tintaSobrePrimario, type BrandingTenant } from './lib/branding'

/** Neutros fijos (D-UI-2). Solo el primario viene del tenant. */
export const NEUTROS = {
  canvas: '#F3F4F6',
  surface: '#FFFFFF',
  line: '#E5E7EB',
  ink: '#111827',
  muted: '#6B7280',
  danger: '#DC2626',
  success: '#047857',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',
} as const

export interface Tema {
  primary: string
  onPrimary: string
  onPrimaryMuted: string
  canvas: string
  surface: string
  line: string
  ink: string
  muted: string
  danger: string
  success: string
  warningBg: string
  warningBorder: string
  warningText: string
}

export function temaDe(branding?: BrandingTenant | null): Tema {
  const primary = colorPrimario(branding)
  return {
    primary,
    onPrimary: '#FFFFFF',
    onPrimaryMuted: tintaSobrePrimario(primary),
    ...NEUTROS,
  }
}

const ThemeContext = createContext<Tema>(temaDe(null))

export function ThemeProvider({
  branding,
  children,
}: {
  branding?: BrandingTenant | null
  children: ReactNode
}) {
  const value = useMemo(() => temaDe(branding), [branding])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Tema {
  return useContext(ThemeContext)
}
