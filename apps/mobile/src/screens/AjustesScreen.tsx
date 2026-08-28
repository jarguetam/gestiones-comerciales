/**
 * M-10 Ajustes (spec F1.11).
 * Perfil del asesor, versión, y cierre de sesión.
 */
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'

interface Props {
  perfil: Perfil
  onLogout: () => void
  onAbrirCola?: () => void
}

export default function AjustesScreen({ perfil, onLogout, onAbrirCola }: Props) {
  async function handleLogout() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    onLogout()
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Nombre</Text>
        <Text style={styles.valor}>{perfil.nombre}</Text>
        <Text style={styles.etiqueta}>Rol</Text>
        <Text style={styles.valor}>{perfil.rol}</Text>
        <Text style={styles.etiqueta}>Empresa</Text>
        <Text style={styles.valor}>{perfil.tenantNombre ?? '—'}</Text>
        <Text style={styles.etiqueta}>Versión</Text>
        <Text style={styles.valor}>0.1.0 (MVP)</Text>
      </View>

      {onAbrirCola ? (
        <TouchableOpacity style={styles.botonCola} onPress={onAbrirCola}>
          <Text style={styles.botonColaTexto}>Cola de sincronización (M-09)</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.botonSalir} onPress={handleLogout}>
        <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F3F4F6', padding: 16 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  etiqueta: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginTop: 8 },
  valor: { fontSize: 15, color: '#111827', fontWeight: '500', marginTop: 2 },
  botonCola: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  botonColaTexto: { color: '#1D4ED8', fontWeight: '600', fontSize: 15 },
  botonSalir: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonSalirTexto: { color: '#B91C1C', fontWeight: '600', fontSize: 15 },
})
