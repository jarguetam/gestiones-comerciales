/**
 * M-02 resumen de gestión sobre la agenda. Cada lectura falla por separado:
 * una tarjeta en error no bloquea la agenda ni las demás.
 */
import React, { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { supabase, type Perfil } from '../lib/supabase'
import { useCola } from '../lib/useCola'
import {
  inicioDiaLocalISO,
  tarjetasVisibles,
  textoEstado,
  textoValor,
  valorDeConteo,
  type ValorTarjeta,
} from '../lib/resumenHoy'
import { TarjetaResumen } from '../components/ui'

export type DestinoResumen = 'leads' | 'solicitudes' | 'depositos' | 'sync'

type Conteos = Record<'leads' | 'solicitudes' | 'depositos', ValorTarjeta>

const CARGANDO: Conteos = {
  leads: { estado: 'cargando' },
  solicitudes: { estado: 'cargando' },
  depositos: { estado: 'cargando' },
}

interface Props {
  perfil: Perfil
  jornada: { total: number; hechas: number; pct: number }
  /** Cambia cuando la agenda se refresca, para releer los conteos. */
  version: number
  onAbrir: (destino: DestinoResumen) => void
}

export default function ResumenHoy({ perfil, jornada, version, onAbrir }: Props) {
  const visibles = tarjetasVisibles(perfil.modulos)
  const { pendientes, resumen } = useCola()
  const [conteos, setConteos] = useState<Conteos>(CARGANDO)
  const conLeads = visibles.includes('leads')
  const conSolicitudes = visibles.includes('solicitudes')
  const conDepositos = visibles.includes('depositos')

  useEffect(() => {
    let vigente = true
    const leer = (id: keyof Conteos, consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      void Promise.resolve(consulta)
        .then((res) => valorDeConteo(res))
        .catch((e: unknown) => valorDeConteo({ count: null, error: { message: e instanceof Error ? e.message : String(e) } }))
        .then((v) => {
          if (vigente) setConteos((prev) => ({ ...prev, [id]: v }))
        })
    }
    if (conLeads) {
      leer(
        'leads',
        supabase
          .from('lead')
          .select('id, estado:lead_estado!inner(es_ganado, es_perdido)', { count: 'exact', head: true })
          .eq('estado.es_ganado', false)
          .eq('estado.es_perdido', false),
      )
    }
    if (conSolicitudes) {
      leer(
        'solicitudes',
        supabase
          .from('solicitud')
          .select('id, estado:solicitud_estado!inner(codigo)', { count: 'exact', head: true })
          .eq('asesor_id', perfil.id)
          .eq('estado.codigo', 'borrador'),
      )
    }
    if (conDepositos) {
      leer(
        'depositos',
        supabase
          .from('deposito')
          .select('id', { count: 'exact', head: true })
          .eq('asesor_id', perfil.id)
          .gte('creado_en', inicioDiaLocalISO(new Date())),
      )
    }
    return () => {
      vigente = false
    }
  }, [conLeads, conSolicitudes, conDepositos, perfil.id, version])

  return (
    <View style={styles.grilla}>
      <TarjetaResumen
        icono="agenda"
        titulo="Visitas"
        valor={`${jornada.hechas} / ${jornada.total}`}
        contexto={jornada.total === 0 ? 'Sin visitas hoy' : `${jornada.pct}% completado`}
        progreso={jornada.pct}
      />
      {conLeads ? (
        <TarjetaResumen
          icono="leads"
          titulo="Leads"
          valor={textoValor(conteos.leads)}
          contexto={textoEstado(conteos.leads, 'abiertos')}
          destino="Leads"
          onPress={() => onAbrir('leads')}
        />
      ) : null}
      {conSolicitudes ? (
        <TarjetaResumen
          icono="solicitudes"
          titulo="Solicitudes"
          valor={textoValor(conteos.solicitudes)}
          contexto={textoEstado(conteos.solicitudes, 'borradores sin enviar')}
          destino="Solicitudes"
          onPress={() => onAbrir('solicitudes')}
        />
      ) : null}
      {conDepositos ? (
        <TarjetaResumen
          icono="depositos"
          titulo="Depósitos"
          valor={textoValor(conteos.depositos)}
          contexto={textoEstado(conteos.depositos, 'registrados hoy')}
          destino="Depósitos"
          onPress={() => onAbrir('depositos')}
        />
      ) : null}
      <TarjetaResumen
        icono="cola"
        titulo="Sincronización"
        valor={String(pendientes)}
        contexto={resumen.errores > 0 ? `pendientes · ${resumen.errores} con error` : 'pendientes'}
        destino="Sincronización"
        onPress={() => onAbrir('sync')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
})
