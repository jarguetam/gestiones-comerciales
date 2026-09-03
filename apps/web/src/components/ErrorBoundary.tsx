import { Component, type ErrorInfo, type ReactNode } from 'react'
import { formatError } from '../lib/erroresUi'
import { lastRequestId } from '../lib/requestContext'
import { reportError } from '../lib/sentry'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
  tenantId?: string | null
  requestId?: string | null
}

interface State {
  err: unknown | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(err: unknown): State {
    return { err }
  }

  componentDidCatch(err: unknown, _info: ErrorInfo) {
    void reportError(err, {
      tenant_id: this.props.tenantId ?? undefined,
      request_id: this.props.requestId ?? lastRequestId() ?? undefined,
    })
  }

  render() {
    if (!this.state.err) return this.props.children
    const formatted = formatError(this.state.err, this.props.requestId ?? lastRequestId() ?? undefined)
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6" role="alert">
          <h2 className="text-xl font-semibold text-ink">Algo salió mal</h2>
          <p className="mt-2 text-sm text-muted">{formatted.message}</p>
          {formatted.code ? <p className="mt-1 text-xs text-muted">{formatted.code}</p> : null}
          {formatted.requestId ? <p className="mt-1 text-xs text-muted">Ref {formatted.requestId}</p> : null}
          <Button className="mt-4 min-h-11" onClick={() => this.setState({ err: null })}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }
}
