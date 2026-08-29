import { QueryClient } from '@tanstack/react-query'

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export const QK = {
  notificaciones: ['notificaciones'] as const,
  visitas: (filtros: unknown) => ['visitas', filtros] as const,
  personas: ['personas'] as const,
  crmFunnel: ['crm-funnel'] as const,
  leadActividad: (id: string) => ['lead-actividad', id] as const,
}
