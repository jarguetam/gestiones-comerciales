/**
 * M-01 Login. Email + contraseña + TOTP si aal1→aal2.
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
import { claimsDe, supabase, type Perfil, cargarPerfil } from '../lib/supabase'
import { requierePasoTotp } from '../lib/mfa'

interface Props {
  onLogin: (perfil: Perfil) => void
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [paso, setPaso] = useState<'password' | 'totp'>('password')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handlePassword() {
    setError(null)
    setCargando(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (requierePasoTotp(aal)) {
        const { data: factors, error: errF } = await supabase.auth.mfa.listFactors()
        if (errF) throw errF
        const totp = factors?.totp?.[0]
        if (!totp) throw new Error('GC-AUTH-002: MFA requerido sin factor TOTP')
        const { data: challenge, error: errC } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (errC) throw errC
        setFactorId(totp.id)
        setChallengeId(challenge.id)
        setPaso('totp')
        return
      }
      await hidratarSesion(data.session.access_token, data.user.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de autenticación')
    } finally {
      setCargando(false)
    }
  }

  async function handleTotp() {
    setError(null)
    setCargando(true)
    try {
      if (!factorId || !challengeId) throw new Error('GC-AUTH-002: desafío MFA incompleto')
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: codigo.trim(),
      })
      if (error) throw error
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('GC-AUTH-021: sesión MFA incompleta')
      await hidratarSesion(data.session.access_token, data.session.user.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código MFA inválido')
    } finally {
      setCargando(false)
    }
  }

  async function hidratarSesion(accessToken: string, userId: string) {
    const claims = claimsDe(accessToken)
    if (!claims) throw new Error('GC-AUTH-021: usuario sin tenant asignado')
    const perfil = await cargarPerfil(userId, claims.tenantId, claims.rol)
    if (!perfil) throw new Error('GC-AUTH-022: no se pudo leer el perfil')
    onLogin(perfil)
  }

  return (
    <KeyboardAvoidingView
      style={styles.fondo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tarjeta}>
        <Text style={styles.eyebrow}>Campo</Text>
        <Text style={styles.titulo}>Gestiones Comerciales</Text>
        <Text style={styles.subtitulo}>
          {paso === 'totp' ? 'Confirmá el código TOTP de tu autenticador.' : 'Asesor de campo'}
        </Text>

        {paso === 'password' ? (
          <>
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
              onSubmitEditing={() => void handlePassword()}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.boton, cargando && styles.botonDeshabilitado]}
              onPress={() => void handlePassword()}
              disabled={cargando || !email || !password}
            >
              {cargando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botonTexto}>Ingresar</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Código MFA"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              value={codigo}
              onChangeText={setCodigo}
              onSubmitEditing={() => void handleTotp()}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.boton, cargando && styles.botonDeshabilitado]}
              onPress={() => void handleTotp()}
              disabled={cargando || !codigo}
            >
              {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Verificar</Text>}
            </TouchableOpacity>
          </>
        )}
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
  eyebrow: { fontSize: 11, color: '#1D4ED8', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 1.4 },
  titulo: { fontSize: 22, fontWeight: '700', color: '#1D4ED8', textAlign: 'center', marginTop: 4 },
  subtitulo: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20, marginTop: 2 },
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
