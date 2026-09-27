interface UsuarioJerarquia {
  id: string
  rol: string
  activo: boolean
}

export function jefeParaInvitacion(rol: string, jefeId: string, usuarios: UsuarioJerarquia[]): string | null {
  if (rol !== 'asesor') return null
  const supervisor = usuarios.find((u) => u.id === jefeId && u.rol === 'supervisor' && u.activo)
  if (!supervisor) throw new Error('Selecciona un supervisor activo para el asesor')
  return supervisor.id
}
