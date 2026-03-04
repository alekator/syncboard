import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { createCardBodySchema, createColumnBodySchema, entityIdSchema } from '@syncboard/shared'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { BoardCard, BoardSnapshot } from '@syncboard/shared'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { moveCardOptimistic } from '@/features/board/dnd/card-dnd'
import { useBoardUiStore } from '@/features/board/model/board-ui-store'
import { useBoardRealtimeSync } from '@/features/board/realtime/use-board-realtime-sync'
import { createCard, createColumn, getBoardSnapshot, updateCard } from '@/features/boards/api/boards-api'

type CreateColumnForm = {
  title: string
}

const createCardFormSchema = createCardBodySchema.extend({
  columnId: entityIdSchema,
})

type CreateCardForm = z.infer<typeof createCardFormSchema>

type DraggableCardProps = {
  card: BoardCard
}

type ColumnDropzoneProps = {
  columnId: string
  cards: BoardCard[]
}

function DraggableCard({ card }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card:${card.id}`,
    data: {
      type: 'card',
      cardId: card.id,
      columnId: card.columnId,
    },
  })

  return (
    <li
      ref={setNodeRef}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <p className="font-medium">{card.title}</p>
      {card.description ? <p className="mt-1 text-xs text-slate-300">{card.description}</p> : null}
    </li>
  )
}

function ColumnDropzone({ columnId, cards }: ColumnDropzoneProps) {
  const { setNodeRef } = useDroppable({
    id: `column:${columnId}`,
    data: {
      type: 'column',
      columnId,
    },
  })

  return (
    <ul ref={setNodeRef} className="space-y-2">
      <SortableContext items={cards.map((card) => `card:${card.id}`)} strategy={verticalListSortingStrategy}>
        {cards.map((card) => (
          <DraggableCard key={card.id} card={card} />
        ))}
      </SortableContext>
    </ul>
  )
}

export function BoardPage() {
  const params = useParams()
  const boardId = params.boardId
  const queryClient = useQueryClient()
  const { selectedColumnId, setSelectedColumnId } = useBoardUiStore()
  const { status: realtimeStatus, onlineUserIds, currentUserId } = useBoardRealtimeSync(boardId)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  )

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

  const moveCardMutation = useMutation({
    mutationFn: (input: { cardId: string; columnId: string; position: number }) =>
      updateCard(input.cardId, { columnId: input.columnId, position: input.position }),
    onError: (_error, variables) => {
      if (boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
      console.error(`Failed to move card ${variables.cardId}`)
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    if (!boardId || !boardQuery.data || !event.over) {
      return
    }

    const activeData = event.active.data.current
    const overData = event.over.data.current

    if (!activeData || activeData.type !== 'card') {
      return
    }

    const activeCardId = String(activeData.cardId)

    let destinationColumnId: string | undefined
    let overCardId: string | undefined

    if (overData?.type === 'column') {
      destinationColumnId = String(overData.columnId)
    }

    if (overData?.type === 'card') {
      destinationColumnId = String(overData.columnId)
      overCardId = String(overData.cardId)
    }

    if (!destinationColumnId) {
      return
    }

    const optimistic = moveCardOptimistic(boardQuery.data, {
      cardId: activeCardId,
      toColumnId: destinationColumnId,
      overCardId,
    })

    if (!optimistic) {
      return
    }

    queryClient.setQueryData<BoardSnapshot>(boardQueryKeys.detail(boardId), optimistic.snapshot)
    moveCardMutation.mutate({
      cardId: optimistic.movedCard.id,
      columnId: optimistic.movedCard.columnId,
      position: optimistic.movedCard.position,
    })
  }

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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-300">Online:</span>
              {onlineUserIds.length === 0 ? (
                <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">
                  nobody
                </span>
              ) : (
                onlineUserIds.map((userId) => (
                  <span
                    key={userId}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                  >
                    {currentUserId === userId ? 'You' : userId.slice(0, 8)}
                  </span>
                ))
              )}
            </div>
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boardQuery.data?.columns.map((column) => (
              <article key={column.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <h2 className="mb-3 text-lg font-semibold">{column.title}</h2>
                <ColumnDropzone columnId={column.id} cards={column.cards} />
              </article>
            ))}
          </section>
        </DndContext>
      </div>
    </main>
  )
}
