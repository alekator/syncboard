import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBoardBodySchema } from '@syncboard/shared'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { useSessionStore } from '@/features/auth/model/session-store'
import { createBoard, deleteBoard, listBoards, updateBoard } from '@/features/boards/api/boards-api'
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
  const boardsQuery = useQuery({
    queryKey: boardQueryKeys.list(),
    queryFn: listBoards,
  })

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
            <button
              type="button"
              onClick={() => clearSession()}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-cyan-500"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
            <input
              {...form.register('name')}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-500"
              placeholder="New board name"
            />
            <button
              type="submit"
              disabled={!canEdit || createBoardMutation.isPending}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createBoardMutation.isPending ? 'Creating...' : 'Create board'}
            </button>
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

          {boardsQuery.isLoading ? <p>Loading boards...</p> : null}
          {boardsQuery.isError ? (
            <p className="text-rose-400">Failed to load boards. Check API connection.</p>
          ) : null}

          {!boardsQuery.isLoading && boardsQuery.data?.boards.length === 0 ? (
            <p className="text-slate-300">No boards yet. Create the first one.</p>
          ) : null}

          <ul className="grid gap-3">
            {boardsQuery.data?.boards.map((board) => (
              <li key={board.id}>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
                  {editingBoardId === board.id ? (
                    <>
                      <input
                        value={editingBoardName}
                        onChange={(event) => setEditingBoardName(event.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:border-cyan-500"
                        aria-label={`Board name ${board.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => saveEditBoard(board.id)}
                        className="rounded-md border border-cyan-600 px-2 py-1 text-xs hover:border-cyan-500"
                        disabled={updateBoardMutation.isPending}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditBoard}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-slate-500"
                        disabled={updateBoardMutation.isPending}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        className="flex flex-1 items-center justify-between hover:text-cyan-300"
                        to={`/boards/${board.id}`}
                      >
                        <span className="font-medium">{board.name}</span>
                        <span className="text-xs text-slate-400">Open</span>
                      </Link>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditBoard(board.id, board.name)}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-cyan-500"
                            aria-label={`Rename ${board.name}`}
                            disabled={updateBoardMutation.isPending || deleteBoardMutation.isPending}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBoardMutation.mutate(board.id)}
                            className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:border-rose-500"
                            aria-label={`Delete ${board.name}`}
                            disabled={updateBoardMutation.isPending || deleteBoardMutation.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
