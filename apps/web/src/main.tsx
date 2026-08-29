import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './app/App'
import { ToastProvider } from './components/ui/Toast'
import { crearQueryClient } from './lib/queryClient'
import './styles.css'

function Root() {
  const [client] = useState(() => crearQueryClient())
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
