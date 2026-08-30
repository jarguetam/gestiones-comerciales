import { registerRootComponent } from 'expo'
import { requireMobileEnv } from './src/lib/env'
import App from './src/App'

requireMobileEnv()

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
// También asegura que, estando el uso del tipo de entorno en Expo Go, el entorno
// esté configurado y activo.
registerRootComponent(App)
