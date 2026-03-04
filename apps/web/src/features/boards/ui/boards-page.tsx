import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBoardBodySchema } from '@syncboard/shared'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { createBoard, listBoards } from '@/features/boards/api/boards-api'

type CreateBoardForm = {
  name: string
}

export function BoardsPage() {
  const queryClient = useQueryClient()
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
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    createBoardMutation.mutate(values)
  })

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">SyncBoard</h1>
          <p className="text-slate-300">Realtime collaboration workspace</p>
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
              disabled={createBoardMutation.isPending}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createBoardMutation.isPending ? 'Creating...' : 'Create board'}
            </button>
          </form>
          {form.formState.errors.name ? (
            <p className="mt-2 text-sm text-rose-400">{form.formState.errors.name.message}</p>
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
                <Link
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 hover:border-cyan-500"
                  to={`/boards/${board.id}`}
                >
                  <span className="font-medium">{board.name}</span>
                  <span className="text-xs text-slate-400">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
