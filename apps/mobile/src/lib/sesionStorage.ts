/**
 * Storage de sesión para supabase-js en el dispositivo.
 * Parte el JSON en chunks de SecureStore (límite ~2 KB en iOS).
 */
import * as SecureStore from 'expo-secure-store'

const CHUNK = 1800

export const sesionStorage = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(key)
    if (meta == null) return null
    const n = Number(meta)
    if (!Number.isFinite(n) || n <= 0) return meta
    const partes: string[] = []
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(`${key}.${i}`)
      if (p == null) return null
      partes.push(p)
    }
    return partes.join('')
  },
  async setItem(key: string, value: string): Promise<void> {
    const n = Math.max(1, Math.ceil(value.length / CHUNK))
    await SecureStore.setItemAsync(key, String(n))
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
    }
  },
  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(key)
    const n = Number(meta)
    await SecureStore.deleteItemAsync(key)
    if (Number.isFinite(n) && n > 0) {
      for (let i = 0; i < n; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`)
      }
    }
  },
}
