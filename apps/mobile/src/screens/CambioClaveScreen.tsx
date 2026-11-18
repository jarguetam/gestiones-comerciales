/**
 * Pantalla única mientras la sesión lleve `debe_cambiar_clave` (contraseña temporal).
 * Solo permite cambiar la contraseña o salir; «Salir» siempre está visible.
 * Mismo flujo que la web (CambioClaveObligatorio): una comprobación al montar, guardar,
 * refrescar la sesión y, si el refresco falla, «Reintentar» (solo refresca).
 */
import React, { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native'
import { supabase } from '../lib/supabase'
import {
  MSG_CAMBIO_HECHO_SIN_CONFIRMAR,
  decidirCambioClave,
  mensajeErrorCambioClave,
  validarClaveNueva,
} from '../lib/cambioClave'
import { Boton, Campo, Card } from '../components/ui'
import { useTheme } from '../theme'

type Fase = 'comprobando' | 'formulario' | 'reintentar'

interface Props {
  sinConexion: boolean
  onListo: () => void
  onSalir: () => void
}

export default function CambioClaveScreen({ sinConexion, onListo, onSalir }: Props) {
  const t = useTheme()
  const [fase, setFase] = useState<Fase>('comprobando')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const comprobado = useRef(false)
  const saliendoRef = useRef(false)
  // Tras «Salir» (o al desmontar) un refresco en vuelo no puede llamar a onListo.
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  // Una sola comprobación por montaje, y nunca sin conexión.
  useEffect(() => {
    if (sinConexion || comprobado.current) return
    comprobado.current = true
    void (async () => {
      try {
        const { data, error: errRefresco } = await supabase.auth.refreshSession()
        if (!vivo.current) return
        if (!errRefresco && data.user && decidirCambioClave(data.user) === 'liberar') {
          onListo()
          return
        }
      } catch {
        // Si el refresco falla se muestra el formulario.
      }
      setFase('formulario')
    })()
  }, [sinConexion])

  // Solo corre tras un `updateUser` exitoso (o desde «Reintentar» en esa misma ruta):
  // la contraseña ya cambió, así que todo fallo aquí es GC-AUTH-039.
  async function refrescar() {
    setError(null)
    setOcupado(true)
    try {
      const { data, error: errRefresco } = await supabase.auth.refreshSession()
      if (!vivo.current) return
      if (errRefresco) {
        setError(MSG_CAMBIO_HECHO_SIN_CONFIRMAR)
        setFase('reintentar')
        return
      }
      if (data.user && decidirCambioClave(data.user) === 'liberar') {
        onListo()
        return
      }
      console.warn('El servidor no quitó debe_cambiar_clave tras el cambio de contraseña: ¿falta el trigger trg_borrar_marca_cambio_clave?')
      setError(MSG_CAMBIO_HECHO_SIN_CONFIRMAR)
      setFase('reintentar')
    } catch {
      setError(MSG_CAMBIO_HECHO_SIN_CONFIRMAR)
      setFase('reintentar')
    } finally {
      setOcupado(false)
    }
  }

  async function guardar() {
    if (ocupado) return
    const invalida = validarClaveNueva(nueva, confirmar)
    if (invalida) {
      setError(invalida)
      return
    }
    setError(null)
    setOcupado(true)
    try {
      const { error: errUpdate } = await supabase.auth.updateUser({ password: nueva })
      if (errUpdate) {
        setError(mensajeErrorCambioClave(errUpdate))
        setOcupado(false)
        return
      }
    } catch (err) {
      setError(mensajeErrorCambioClave(err as { message?: string }))
      setOcupado(false)
      return
    }
    setOcupado(false)
    await refrescar()
  }

  function salir() {
    if (saliendoRef.current) return
    saliendoRef.current = true
    setSaliendo(true)
    vivo.current = false
    onSalir()
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fondo, { backgroundColor: t.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={[styles.titulo, { color: t.ink }]}>Cambia tu contraseña</Text>

          {sinConexion ? (
            <Text style={[styles.texto, { color: t.muted }]}>
              Necesitas señal para cambiar tu contraseña. Conéctate e inténtalo de nuevo.
            </Text>
          ) : fase === 'comprobando' ? (
            <Text style={[styles.texto, { color: t.muted }]}>Comprobando tu sesión…</Text>
          ) : fase === 'formulario' ? (
            <>
              <Text style={[styles.texto, { color: t.muted }]}>
                Entraste con una contraseña temporal. Elige una nueva para continuar.
              </Text>
              <Campo
                label="Contraseña nueva"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                value={nueva}
                onChangeText={setNueva}
              />
              <Campo
                label="Confirmar contraseña"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                value={confirmar}
                onChangeText={setConfirmar}
                onSubmitEditing={() => void guardar()}
              />
              {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
              <Boton
                etiqueta="Guardar contraseña"
                onPress={() => void guardar()}
                disabled={!nueva || !confirmar}
                cargando={ocupado}
              />
            </>
          ) : (
            <>
              {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
              <Boton etiqueta="Reintentar" onPress={() => void refrescar()} cargando={ocupado} />
            </>
          )}

          <Boton etiqueta="Salir" variante="ghost" onPress={salir} disabled={saliendo} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  contenido: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  texto: { fontSize: 14, marginBottom: 16 },
  error: { fontSize: 13, marginBottom: 10 },
})
