import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
