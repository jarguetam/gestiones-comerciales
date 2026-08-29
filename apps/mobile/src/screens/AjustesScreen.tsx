/**
 * M-10 Ajustes (spec F1.11).
 * Perfil del asesor, versión, y cierre de sesión.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BACKEND_CONFIGURADO, desactivarSesionDemo, supabase, type Perfil } from '../lib/supabase'
import { Boton, Card } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  perfil: Perfil
  onLogout: () => void
  onAbrirCola?: () => void
}

export default function AjustesScreen({ perfil, onLogout, onAbrirCola }: Props) {
  const t = useTheme()
  async function handleLogout() {
    desactivarSesionDemo()
    if (BACKEND_CONFIGURADO) await supabase.auth.signOut()
    onLogout()
  }

  return (
    <View style={[styles.contenedor, { backgroundColor: t.canvas }]}>
      <Card>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Nombre</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{perfil.nombre}</Text>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Rol</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{perfil.rol}</Text>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Empresa</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{perfil.tenantNombre ?? '—'}</Text>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Versión</Text>
        <Text style={[styles.valor, { color: t.ink }]}>0.1.0 (MVP)</Text>
      </Card>

      <View style={{ gap: 10 }}>
        {onAbrirCola ? (
          <Boton etiqueta="Cola de sincronización" variante="secondary" onPress={onAbrirCola} />
        ) : null}
        <Boton etiqueta="Cerrar sesión" variante="ghost" onPress={() => void handleLogout()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 16, gap: 16 },
  etiqueta: { fontSize: 11, textTransform: 'uppercase', marginTop: 8 },
  valor: { fontSize: 15, fontWeight: '500', marginTop: 2 },
})
