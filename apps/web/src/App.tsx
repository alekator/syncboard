import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'
import { ToastViewport } from './shared/ui/toast-viewport'

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
      <ToastViewport />
    </AppProviders>
  )
}
