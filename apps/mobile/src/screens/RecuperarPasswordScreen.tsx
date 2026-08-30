/**
 * Recuperación de contraseña. Redirect deep link `gc://recuperar`.
 */
import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { Boton, Campo } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  onVolver: () => void
}

export default function RecuperarPasswordScreen({ onVolver }: Props) {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar() {
    setError(null)
    setAviso(null)
    setCargando(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'gc://recuperar',
      })
      if (error) throw error
      setAviso('Si el email existe, vas a recibir un enlace para restablecer la contraseña.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el enlace (GC-AUTH-021)')
    } finally {
      setCargando(false)
    }
  }

  return (
    <View style={[styles.box, { backgroundColor: t.canvas }]}>
      <Text style={[styles.titulo, { color: t.ink }]}>Recuperar contraseña</Text>
      <Text style={[styles.ayuda, { color: t.muted }]}>
        Te enviamos un enlace. Al abrirlo, la app vuelve por gc://recuperar.
      </Text>
      <Campo
        label="Email"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
      {aviso ? <Text style={[styles.aviso, { color: t.ink }]}>{aviso}</Text> : null}
      <Boton
        etiqueta="Enviar enlace"
        onPress={() => void enviar()}
        disabled={!email.trim()}
        cargando={cargando}
      />
      <Boton etiqueta="Volver al ingreso" variante="ghost" onPress={onVolver} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  titulo: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  ayuda: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  error: { fontSize: 13 },
  aviso: { fontSize: 13 },
})
