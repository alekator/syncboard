import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/features/auth/model/session-store'
import { BoardsPage } from './boards-page'

const listBoardsMock = vi.fn()
const createBoardMock = vi.fn()
const updateBoardMock = vi.fn()
const deleteBoardMock = vi.fn()

vi.mock('@/features/boards/api/boards-api', () => ({
  listBoards: () => listBoardsMock(),
  createBoard: (payload: { name: string }) => createBoardMock(payload),
  updateBoard: (boardId: string, payload: { name: string }) => updateBoardMock(boardId, payload),
  deleteBoard: (boardId: string) => deleteBoardMock(boardId),
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
        <BoardsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('BoardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.setState({
      token: 'token-owner',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Owner',
        role: 'owner',
      },
    })
    listBoardsMock.mockResolvedValue({
      boards: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Platform',
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z',
        },
      ],
    })
    createBoardMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Platform',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
    })
    updateBoardMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Platform Updated',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
    })
    deleteBoardMock.mockResolvedValue(undefined)
  })

  it('creates a board from form submit', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('New board name'), 'Platform')
    await user.click(screen.getByRole('button', { name: 'Create board' }))

    await waitFor(() => {
      expect(createBoardMock).toHaveBeenCalledWith({ name: 'Platform' })
    })
  })

  it('shows validation message for empty form', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Create board' }))

    expect(await screen.findByText(/expected string to have >=1 characters/)).toBeVisible()
    expect(createBoardMock).not.toHaveBeenCalled()
  })

  it('renames a board from list item actions', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Platform')
    await user.click(screen.getByRole('button', { name: 'Rename Platform' }))
    await user.clear(screen.getByLabelText('Board name Platform'))
    await user.type(screen.getByLabelText('Board name Platform'), 'Platform Updated')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateBoardMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        name: 'Platform Updated',
      })
    })
  })

  it('deletes a board from list item actions', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Platform')
    await user.click(screen.getByRole('button', { name: 'Delete Platform' }))

    await waitFor(() => {
      expect(deleteBoardMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    })
  })

  it('disables board creation for viewer role', async () => {
    useSessionStore.setState({
      token: 'token-viewer',
      user: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Viewer',
        role: 'viewer',
      },
    })
    const user = userEvent.setup()
    renderPage()

    const button = screen.getByRole('button', { name: 'Create board' })
    expect(button).toBeDisabled()

    await user.click(button)
    expect(createBoardMock).not.toHaveBeenCalled()
    expect(updateBoardMock).not.toHaveBeenCalled()
    expect(deleteBoardMock).not.toHaveBeenCalled()
    expect(screen.getByText('Viewer role: board creation is disabled.')).toBeVisible()
  })

  it('allows retry when boards loading fails', async () => {
    listBoardsMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        boards: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Platform',
            createdAt: '2026-03-05T00:00:00.000Z',
            updatedAt: '2026-03-05T00:00:00.000Z',
          },
        ],
      })

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Failed to load boards. Check API connection.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(listBoardsMock).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Platform')).toBeVisible()
  })
})
