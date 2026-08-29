import React, { type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../../theme'

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
})
