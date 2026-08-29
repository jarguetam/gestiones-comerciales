import React from 'react'
import { View } from 'react-native'

export type IconoName =
  | 'agenda'
  | 'personas'
  | 'leads'
  | 'formularios'
  | 'mas'
  | 'salir'
  | 'solicitudes'
  | 'depositos'
  | 'ajustes'
  | 'checkin'
  | 'vacio'
  | 'inbox'
  | 'cola'

/** Iconos de trazo con Views. Evita emoji en chrome de campo. */
export function Icono({ name, color, size = 22 }: { name: IconoName; color: string; size?: number }) {
  const s = size
  const w = 1.7
  if (name === 'mas') {
    return (
      <View style={{ width: s, height: s, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: color }} />
        ))}
      </View>
    )
  }
  if (name === 'salir') {
    return (
      <View style={{ width: s, height: s, justifyContent: 'center' }}>
        <View style={{ width: s * 0.42, height: s * 0.72, borderWidth: w, borderColor: color, borderRightWidth: 0, borderRadius: 2 }} />
        <View
          style={{
            position: 'absolute',
            right: 1,
            width: s * 0.42,
            height: w,
            backgroundColor: color,
          }}
        />
      </View>
    )
  }
  if (name === 'checkin') {
    return (
      <View style={{ width: s, height: s, alignItems: 'center' }}>
        <View
          style={{
            width: s * 0.62,
            height: s * 0.62,
            borderRadius: s,
            borderWidth: w,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: s * 0.2, height: s * 0.2, borderRadius: s, backgroundColor: color }} />
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 4,
            borderRightWidth: 4,
            borderTopWidth: 6,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: color,
            marginTop: -1,
          }}
        />
      </View>
    )
  }
  // Marco común (lista / ficha / casa simplificada)
  return (
    <View
      style={{
        width: s,
        height: s,
        borderWidth: w,
        borderColor: color,
        borderRadius: name === 'agenda' || name === 'formularios' || name === 'solicitudes' ? 3 : 5,
        padding: 3,
        justifyContent: name === 'personas' || name === 'leads' ? 'flex-start' : 'space-evenly',
        alignItems: name === 'personas' || name === 'leads' ? 'center' : 'stretch',
      }}
    >
      {name === 'personas' || name === 'leads' ? (
        <>
          <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: w, borderColor: color, marginTop: 1 }} />
          <View style={{ width: s * 0.55, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: w, borderColor: color, borderBottomWidth: 0, marginTop: 2 }} />
        </>
      ) : name === 'vacio' ? (
        <>
          <View style={{ height: w, backgroundColor: color, marginTop: 4 }} />
          <View style={{ height: w, backgroundColor: color, width: '60%' }} />
        </>
      ) : (
        <>
          <View style={{ height: w, backgroundColor: color }} />
          <View style={{ height: w, backgroundColor: color }} />
          {name === 'agenda' || name === 'cola' || name === 'inbox' ? <View style={{ height: w, backgroundColor: color, width: '45%' }} /> : null}
        </>
      )}
    </View>
  )
}
