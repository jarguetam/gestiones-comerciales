/**
 * M-01 Login (spec F1.10/F1.11).
 * Autenticación con email + contraseña; los claims duales {tenant_id, rol}
 * ya vienen en el JWT (trigger F0.3) — la app no los inventa.
 */
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { claimsDe, DEMO_MODE, supabase, type Perfil, cargarPerfil } from '../lib/supabase'

interface Props {
  onLogin: (perfil: Perfil) => void
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleLogin() {
    setError(null)
    setCargando(true)
    try {
      if (DEMO_MODE) {
        throw new Error('GC-AUTH-020: modo demo — configura EXPO_PUBLIC_SUPABASE_URL/ANON_KEY')
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      const claims = claimsDe(data.session.access_token)
      if (!claims) throw new Error('GC-AUTH-021: usuario sin tenant asignado')
      const perfil = await cargarPerfil(data.user.id, claims.tenantId, claims.rol)
      if (!perfil) throw new Error('GC-AUTH-022: no se pudo leer el perfil')
      onLogin(perfil)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de autenticación')
    } finally {
      setCargando(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fondo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Gestiones Comerciales</Text>
        <Text style={styles.subtitulo}>Asesor de campo</Text>

        {DEMO_MODE && (
          <View style={styles.demo}>
            <Text style={styles.demoTexto}>
              Modo demo: configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY para
              conectar.
            </Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={handleLogin}
          disabled={cargando || !email || !password}
        >
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>Ingresar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', padding: 24 },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  titulo: { fontSize: 22, fontWeight: '700', color: '#1D4ED8', textAlign: 'center' },
  subtitulo: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20, marginTop: 2 },
  demo: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  demoTexto: { color: '#92400E', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  error: { color: '#DC2626', fontSize: 13, marginBottom: 10 },
  boton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
