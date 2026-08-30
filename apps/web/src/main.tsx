import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import { crearQueryClient } from './lib/queryClient'
import { environmentFromVite, requireBuildEnv } from './lib/env'
import { bootSentry } from './lib/sentry'
import './styles.css'

void bootSentry(
  requireBuildEnv({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_ENVIRONMENT: environmentFromVite(import.meta.env.VITE_ENVIRONMENT),
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_RELEASE: import.meta.env.VITE_RELEASE,
  }),
)

function Root() {
  const [client] = useState(() => crearQueryClient())
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
