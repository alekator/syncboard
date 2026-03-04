import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCardBodySchema, createColumnBodySchema, entityIdSchema } from '@syncboard/shared'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { useBoardUiStore } from '@/features/board/model/board-ui-store'
import { useBoardRealtimeSync } from '@/features/board/realtime/use-board-realtime-sync'
import { createCard, createColumn, getBoardSnapshot } from '@/features/boards/api/boards-api'

type CreateColumnForm = {
  title: string
}

const createCardFormSchema = createCardBodySchema.extend({
  columnId: entityIdSchema,
})

type CreateCardForm = z.infer<typeof createCardFormSchema>

export function BoardPage() {
  const params = useParams()
  const boardId = params.boardId
  const queryClient = useQueryClient()
  const { selectedColumnId, setSelectedColumnId } = useBoardUiStore()
  const realtimeStatus = useBoardRealtimeSync(boardId)

  const boardQuery = useQuery({
    queryKey: boardId ? boardQueryKeys.detail(boardId) : ['boards', 'invalid-id'],
    queryFn: () => getBoardSnapshot(boardId ?? ''),
    enabled: Boolean(boardId),
  })

  const createColumnForm = useForm<CreateColumnForm>({
    resolver: zodResolver(createColumnBodySchema),
    defaultValues: {
      title: '',
    },
  })

  const createCardForm = useForm<CreateCardForm>({
    resolver: zodResolver(createCardFormSchema),
    defaultValues: {
      title: '',
      description: '',
      columnId: '',
    },
  })
  const selectedCardColumnId = useWatch({
    control: createCardForm.control,
    name: 'columnId',
  })

  useEffect(() => {
    const firstColumnId = boardQuery.data?.columns[0]?.id
    if (!selectedColumnId && firstColumnId) {
      setSelectedColumnId(firstColumnId)
      createCardForm.setValue('columnId', firstColumnId)
    }
  }, [boardQuery.data?.columns, createCardForm, selectedColumnId, setSelectedColumnId])

  const createColumnMutation = useMutation({
    mutationFn: (input: CreateColumnForm) => createColumn(boardId ?? '', input),
    onSuccess: () => {
      createColumnForm.reset()
      if (boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
    },
  })

  const createCardMutation = useMutation({
    mutationFn: (input: CreateCardForm) =>
      createCard(input.columnId, { title: input.title, description: input.description }),
    onSuccess: () => {
      createCardForm.reset({
        title: '',
        description: '',
        columnId: selectedColumnId ?? '',
      })
      if (boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
    },
  })

  if (!boardId) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <p>Invalid board id</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {boardQuery.data?.board.name ?? 'Loading board...'}
            </h1>
            <p className="text-sm text-slate-300">Board id: {boardId}</p>
            <p className="text-xs uppercase tracking-wide text-cyan-400">
              Realtime: {realtimeStatus}
            </p>
          </div>
          <Link className="text-sm text-cyan-400 hover:text-cyan-300" to="/">
            Back to boards
          </Link>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={createColumnForm.handleSubmit((values) => createColumnMutation.mutate(values))}
          >
            <input
              {...createColumnForm.register('title')}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500"
              placeholder="Column title"
            />
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={createColumnMutation.isPending}
            >
              Add column
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={createCardForm.handleSubmit((values) => createCardMutation.mutate(values))}
          >
            <input
              {...createCardForm.register('title')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500"
              placeholder="Card title"
            />
            <input
              {...createCardForm.register('description')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500"
              placeholder="Description (optional)"
            />
            <select
              {...createCardForm.register('columnId')}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              onChange={(event) => {
                const columnId = event.target.value
                setSelectedColumnId(columnId)
                createCardForm.setValue('columnId', columnId, { shouldDirty: true })
              }}
              value={selectedCardColumnId ?? ''}
            >
              <option value="">Select column</option>
              {boardQuery.data?.columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={createCardMutation.isPending}
            >
              Add card
            </button>
          </form>
        </section>

        {boardQuery.isLoading ? <p>Loading board snapshot...</p> : null}
        {boardQuery.isError ? <p className="text-rose-400">Failed to load board snapshot.</p> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boardQuery.data?.columns.map((column) => (
            <article key={column.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <h2 className="mb-3 text-lg font-semibold">{column.title}</h2>
              <ul className="space-y-2">
                {column.cards.map((card) => (
                  <li key={card.id} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                    <p className="font-medium">{card.title}</p>
                    {card.description ? (
                      <p className="mt-1 text-xs text-slate-300">{card.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
