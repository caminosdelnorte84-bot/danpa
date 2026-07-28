import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: 'var(--danger-bg)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-primary)' }}>Algo salió mal</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary)' }}>
              Ocurrió un error inesperado. Recargá la página para continuar.
            </p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition"
              style={{ background: 'var(--brand)' }}>
              Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}