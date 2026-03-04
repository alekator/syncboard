import { Component, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled application error', error)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
          <div className="w-full max-w-md rounded-xl border border-rose-800 bg-slate-900/80 p-6 text-center">
            <h1 className="text-xl font-semibold text-rose-300">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-300">
              The application crashed unexpectedly. Try reloading the page.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-md border border-cyan-600 px-3 py-1 text-xs hover:border-cyan-500"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:border-slate-500"
              >
                Back to home
              </button>
            </div>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
