/** Token FCM nativo (no Expo push) para Edge push-notifications. */

import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

export async function tokenPushNativo(): Promise<string | null> {
  if (!Device.isDevice) return null
  const { status: actual } = await Notifications.getPermissionsAsync()
  let status = actual
  if (status !== 'granted') {
    const pedido = await Notifications.requestPermissionsAsync()
    status = pedido.status
  }
  if (status !== 'granted') return null
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
  const token = await Notifications.getDevicePushTokenAsync()
  return token.data ?? null
}
