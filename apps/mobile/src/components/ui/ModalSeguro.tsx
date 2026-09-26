import React from 'react'
import { Modal, type ModalProps } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

/** Cada ventana modal mide sus propias barras del sistema. */
export function ModalSeguro({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}
