import React from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { useTheme } from '../../theme'

export function Campo({
  label,
  hint,
  ...rest
}: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme()
  const id = rest.accessibilityLabel ?? label
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.ink }]}>{label}</Text>
      <TextInput
        {...rest}
        accessibilityLabel={id}
        placeholderTextColor={t.muted}
        style={[
          styles.input,
          { borderColor: t.line, color: t.ink, backgroundColor: t.surface },
          rest.style,
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: t.muted }]}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  hint: { fontSize: 11, marginTop: 4 },
})
