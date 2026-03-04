import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/features/auth/model/session-store'
import { LoginPage } from './login-page'

const loginMock = vi.fn()

vi.mock('@/features/auth/api/auth-api', () => ({
  login: (payload: { name: string; role: 'owner' | 'editor' | 'viewer' }) => loginMock(payload),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LoginPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.setState({ token: null, user: null })
    loginMock.mockResolvedValue({
      token: 'token-editor',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Azazel',
        role: 'editor',
      },
    })
  })

  it('submits login form and saves session', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('Your name'), 'Azazel')
    await user.selectOptions(screen.getByRole('combobox'), 'editor')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ name: 'Azazel', role: 'editor' })
    })
    expect(useSessionStore.getState().token).toBe('token-editor')
    expect(useSessionStore.getState().user?.name).toBe('Azazel')
  })
})
