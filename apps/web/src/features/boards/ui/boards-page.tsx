import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBoardBodySchema } from '@syncboard/shared'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { useSessionStore } from '@/features/auth/model/session-store'
import { createBoard, deleteBoard, listBoards, updateBoard } from '@/features/boards/api/boards-api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { useToast } from '@/shared/ui/toast-store'

type CreateBoardForm = {
  name: string
}

export function BoardsPage() {
  const queryClient = useQueryClient()
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)
  const canEdit = user ? user.role !== 'viewer' : false
  const toast = useToast()
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingBoardName, setEditingBoardName] = useState('')
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const boardsQuery = useQuery({
    queryKey: boardQueryKeys.list(),
    queryFn: listBoards,
  })
  const boards = boardsQuery.data?.boards ?? []
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: boards.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 64,
    overscan: 6,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  const form = useForm<CreateBoardForm>({
    resolver: zodResolver(createBoardBodySchema),
    defaultValues: {
      name: '',
    },
  })

  const createBoardMutation = useMutation({
    mutationFn: (input: CreateBoardForm) => createBoard(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardQueryKeys.list() })
      form.reset()
      toast.success('Board created')
    },
    onError: () => {
      toast.error('Failed to create board')
    },
  })

  const updateBoardMutation = useMutation({
    mutationFn: (input: { boardId: string; name: string }) => updateBoard(input.boardId, { name: input.name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardQueryKeys.list() })
      setEditingBoardId(null)
      setEditingBoardName('')
      toast.success('Board renamed')
    },
    onError: () => {
      toast.error('Failed to rename board')
    },
  })

  const deleteBoardMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardQueryKeys.list() })
      toast.success('Board deleted')
    },
    onError: () => {
      toast.error('Failed to delete board')
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    if (!canEdit) {
      return
    }

    createBoardMutation.mutate(values)
  })

  const startEditBoard = (boardId: string, boardName: string) => {
    setEditingBoardId(boardId)
    setEditingBoardName(boardName)
  }

  const cancelEditBoard = () => {
    setEditingBoardId(null)
    setEditingBoardName('')
  }

  const saveEditBoard = (boardId: string) => {
    const nextName = editingBoardName.trim()
    if (!nextName) {
      return
    }

    updateBoardMutation.mutate({ boardId, name: nextName })
  }

  const renderBoardItem = (board: { id: string; name: string }) => (
    <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
      {editingBoardId === board.id ? (
        <>
          <Input
            value={editingBoardName}
            onChange={(event) => setEditingBoardName(event.target.value)}
            className="h-8 bg-slate-900 px-2 py-1"
            aria-label={`Board name ${board.name}`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => saveEditBoard(board.id)}
            disabled={updateBoardMutation.isPending}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelEditBoard}
            disabled={updateBoardMutation.isPending}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Link className="flex flex-1 items-center justify-between hover:text-cyan-300" to={`/boards/${board.id}`}>
            <span className="font-medium">{board.name}</span>
            <span className="text-xs text-slate-400">Open</span>
          </Link>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startEditBoard(board.id, board.name)}
                aria-label={`Rename ${board.name}`}
                disabled={updateBoardMutation.isPending || deleteBoardMutation.isPending}
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => deleteBoardMutation.mutate(board.id)}
                aria-label={`Delete ${board.name}`}
                disabled={updateBoardMutation.isPending || deleteBoardMutation.isPending}
              >
                Delete
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">SyncBoard</h1>
              <p className="text-slate-300">Realtime collaboration workspace</p>
              {user ? (
                <p className="mt-1 text-xs text-slate-400">
                  Signed in as {user.name} ({user.role})
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => clearSession()}
            >
              Sign out
            </Button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
            <Input
              {...form.register('name')}
              className="h-10 w-full"
              placeholder="New board name"
            />
            <Button
              type="submit"
              disabled={!canEdit || createBoardMutation.isPending}
            >
              {createBoardMutation.isPending ? 'Creating...' : 'Create board'}
            </Button>
          </form>
          {form.formState.errors.name ? (
            <p className="mt-2 text-sm text-rose-400">{form.formState.errors.name.message}</p>
          ) : null}
          {!canEdit ? (
            <p className="mt-2 text-sm text-amber-300">Viewer role: board creation is disabled.</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="mb-4 text-lg font-semibold">Boards</h2>

          {boardsQuery.isLoading ? (
            <div role="status" aria-label="Loading boards" className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : null}
          {boardsQuery.isError ? (
            <div className="flex items-center gap-3">
              <p className="text-rose-400">Failed to load boards. Check API connection.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void boardsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {!boardsQuery.isLoading && boards.length === 0 ? (
            <p className="text-slate-300">No boards yet. Create the first one.</p>
          ) : null}

          {boards.length > 0 ? (
            <div ref={listScrollRef} className="max-h-[28rem] overflow-auto pr-1">
              {virtualRows.length === 0 ? (
                <ul className="grid gap-3">
                  {boards.map((board) => (
                    <li key={board.id}>{renderBoardItem(board)}</li>
                  ))}
                </ul>
              ) : (
                <ul className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                  {virtualRows.map((row) => {
                    const board = boards[row.index]
                    return (
                      <li
                        key={board.id}
                        className="absolute left-0 top-0 w-full pb-3"
                        style={{ transform: `translateY(${row.start}px)` }}
                      >
                        {renderBoardItem(board)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
