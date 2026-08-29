import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { colorPrimario, tintaSobrePrimario, type BrandingTenant } from './lib/branding'
import { NEUTROS } from './themeTokens'

export { NEUTROS } from './themeTokens'

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
  warn: string
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
