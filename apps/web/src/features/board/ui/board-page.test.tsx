import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardSnapshot } from '@syncboard/shared'

import { useSessionStore } from '@/features/auth/model/session-store'
import { useBoardUiStore } from '@/features/board/model/board-ui-store'
import { BoardPage } from './board-page'

const getBoardSnapshotMock = vi.fn()

vi.mock('@/features/boards/api/boards-api', () => ({
  getBoardSnapshot: (boardId: string) => getBoardSnapshotMock(boardId),
  createColumn: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  updateColumn: vi.fn(),
  deleteCard: vi.fn(),
}))

vi.mock('@/features/board/realtime/use-board-realtime-sync', () => ({
  useBoardRealtimeSync: () => ({
    status: 'connected',
    onlineUserIds: [],
    draggingUserIds: [],
    currentUserId: '11111111-1111-4111-8111-111111111111',
    sendDraggingActivity: vi.fn(),
  }),
}))

function createSnapshot(columns: BoardSnapshot['columns']): BoardSnapshot {
  return {
    board: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Board',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
    },
    columns,
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <MemoryRouter initialEntries={['/boards/11111111-1111-4111-8111-111111111111']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('BoardPage', () => {
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
    useBoardUiStore.setState({ selectedColumnId: null })
  })

  it('shows empty state when board has no columns', async () => {
    getBoardSnapshotMock.mockResolvedValue(createSnapshot([]))

    renderPage()

    expect(
      await screen.findByText('No columns yet. Create the first column to start collaborating.'),
    ).toBeVisible()
  })

  it('shows no-results state when search does not match cards', async () => {
    getBoardSnapshotMock.mockResolvedValue(
      createSnapshot([
        {
          id: '22222222-2222-4222-8222-222222222222',
          boardId: '11111111-1111-4111-8111-111111111111',
          title: 'Backlog',
          position: 1000,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z',
          cards: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              boardId: '11111111-1111-4111-8111-111111111111',
              columnId: '22222222-2222-4222-8222-222222222222',
              title: 'Auth flow',
              description: 'Implement login',
              position: 1000,
              createdAt: '2026-03-05T00:00:00.000Z',
              updatedAt: '2026-03-05T00:00:00.000Z',
            },
          ],
        },
      ]),
    )

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Auth flow')

    await user.type(screen.getByRole('textbox', { name: 'Search cards' }), 'nomatch')

    expect(await screen.findByText('No cards match your search query.')).toBeVisible()
  })
})
