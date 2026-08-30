/**
 * M-01 Login (spec F1.10/F1.11).
 * Email + contraseña + TOTP si aal1→aal2. Sin modo demo.
 */
import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { Session } from '@supabase/supabase-js'
import {
  supabase,
  type Perfil,
  cargarPerfil,
  resolverClaims,
} from '../lib/supabase'
import { requierePasoTotp } from '../lib/mfa'
import { Boton, Campo, Marca } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  onLogin: (perfil: Perfil) => void
  onRecuperar?: () => void
}

export default function LoginScreen({ onLogin, onRecuperar }: Props) {
  const t = useTheme()
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
      if (!data.session) throw new Error('Sesión incompleta (GC-AUTH-021)')
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (requierePasoTotp(aal)) {
        const { data: factors, error: errF } = await supabase.auth.mfa.listFactors()
        if (errF) throw errF
        const totp = factors?.totp?.[0]
        if (!totp) throw new Error('MFA requerido sin factor TOTP (GC-AUTH-002)')
        const { data: challenge, error: errC } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (errC) throw errC
        setFactorId(totp.id)
        setChallengeId(challenge.id)
        setPaso('totp')
        return
      }
      await hidratarSesion(data.session)
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
      if (!factorId || !challengeId) throw new Error('Desafío MFA incompleto (GC-AUTH-002)')
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: codigo.trim(),
      })
      if (error) throw error
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Sesión MFA incompleta (GC-AUTH-021)')
      await hidratarSesion(data.session)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código MFA inválido')
    } finally {
      setCargando(false)
    }
  }

  async function hidratarSesion(session: Session) {
    const claims = await resolverClaims(session)
    if (!claims) throw new Error('Usuario sin tenant asignado (GC-AUTH-021)')
    const perfil = await cargarPerfil(session, claims)
    onLogin(perfil)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fondo, { backgroundColor: t.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.tarjeta, { backgroundColor: t.surface }]}>
        <View style={styles.marca}>
          <Marca nombre="Gestiones Comerciales" />
        </View>
        <Text style={[styles.titulo, { color: t.ink }]}>Ruta de campo</Text>
        <Text style={[styles.subtitulo, { color: t.muted }]}>
          {paso === 'totp' ? 'Confirmá el código TOTP de tu autenticador.' : 'Jornada del asesor'}
        </Text>

        {paso === 'password' ? (
          <>
            <Campo
              label="Email"
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <Campo
              label="Contraseña"
              placeholder="Contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void handlePassword()}
            />
            {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
            <Boton
              etiqueta="Ingresar"
              onPress={() => void handlePassword()}
              disabled={!email || !password}
              cargando={cargando}
            />
            {onRecuperar ? (
              <Boton etiqueta="Olvidé mi contraseña" variante="ghost" onPress={onRecuperar} />
            ) : null}
          </>
        ) : (
          <>
            <Campo
              label="Código MFA"
              placeholder="Código MFA"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              value={codigo}
              onChangeText={setCodigo}
              onSubmitEditing={() => void handleTotp()}
            />
            {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
            <Boton
              etiqueta="Verificar"
              onPress={() => void handleTotp()}
              disabled={!codigo}
              cargando={cargando}
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'center', padding: 24 },
  tarjeta: {
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  marca: { alignItems: 'center', marginBottom: 8 },
  titulo: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center', marginTop: 4 },
  subtitulo: { fontSize: 13, textAlign: 'center', marginBottom: 20, marginTop: 2 },
  error: { fontSize: 13, marginBottom: 10 },
})
