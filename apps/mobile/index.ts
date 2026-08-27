import { registerRootComponent } from 'expo'
import App from './src/App'

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App)
// También asegura que, estando el uso del tipo de entorno en Expo Go, el entorno
// esté configurado y activo.
registerRootComponent(App)
