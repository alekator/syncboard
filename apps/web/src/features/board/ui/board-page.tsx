import { useEffect, useState } from 'react'
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
import { useSessionStore } from '@/features/auth/model/session-store'
import { moveCardOptimistic } from '@/features/board/dnd/card-dnd'
import { reorderColumnOptimistic } from '@/features/board/dnd/column-order'
import { filterSnapshotCards } from '@/features/board/model/card-filter'
import { useBoardUiStore } from '@/features/board/model/board-ui-store'
import { useBoardRealtimeSync } from '@/features/board/realtime/use-board-realtime-sync'
import {
  createCard,
  createColumn,
  deleteCard,
  getBoardSnapshot,
  updateCard,
  updateColumn,
} from '@/features/boards/api/boards-api'
import { useToast } from '@/shared/ui/toast-store'

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position)
}

type CreateColumnForm = {
  title: string
}

const createCardFormSchema = createCardBodySchema.extend({
  columnId: entityIdSchema,
})

type CreateCardForm = z.infer<typeof createCardFormSchema>

type EditCardForm = {
  title: string
  description: string
}

type DraggableCardProps = {
  card: BoardCard
  disabled: boolean
  canEdit: boolean
  isEditing: boolean
  editForm: EditCardForm
  onStartEdit: (card: BoardCard) => void
  onChangeEditForm: (next: EditCardForm) => void
  onSaveEdit: (cardId: string) => void
  onCancelEdit: () => void
  onDelete: (cardId: string) => void
}

type ColumnDropzoneProps = {
  columnId: string
  cards: BoardCard[]
  dndDisabled: boolean
  canEdit: boolean
  editingCardId: string | null
  editCardForm: EditCardForm
  onStartEditCard: (card: BoardCard) => void
  onChangeEditCardForm: (next: EditCardForm) => void
  onSaveEditCard: (cardId: string) => void
  onCancelEditCard: () => void
  onDeleteCard: (cardId: string) => void
}

function DraggableCard({
  card,
  disabled,
  canEdit,
  isEditing,
  editForm,
  onStartEdit,
  onChangeEditForm,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card:${card.id}`,
    disabled: disabled || isEditing,
    data: {
      type: 'card',
      cardId: card.id,
      columnId: card.columnId,
    },
  })
  const sortableProps = isEditing ? {} : { ...attributes, ...listeners }

  return (
    <li
      ref={setNodeRef}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      {...sortableProps}
    >
      {isEditing ? (
        <div className="space-y-2" onPointerDown={(event) => event.stopPropagation()}>
          <input
            value={editForm.title}
            onChange={(event) => onChangeEditForm({ ...editForm, title: event.target.value })}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:border-cyan-500"
            aria-label={`Card title ${card.title}`}
          />
          <input
            value={editForm.description}
            onChange={(event) =>
              onChangeEditForm({
                ...editForm,
                description: event.target.value,
              })
            }
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-cyan-500"
            placeholder="Description"
            aria-label={`Card description ${card.title}`}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSaveEdit(card.id)}
              className="rounded-md border border-cyan-600 px-2 py-1 text-xs hover:border-cyan-500"
            >
              Save card
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-slate-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-medium">{card.title}</p>
          {card.description ? <p className="mt-1 text-xs text-slate-300">{card.description}</p> : null}
          {canEdit ? (
            <div className="mt-2 flex items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => onStartEdit(card)}
                onPointerDown={(event) => event.stopPropagation()}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-cyan-500"
                aria-label={`Edit ${card.title}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(card.id)}
                onPointerDown={(event) => event.stopPropagation()}
                className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-300 hover:border-rose-500"
                aria-label={`Delete ${card.title}`}
              >
                Delete
              </button>
            </div>
          ) : null}
        </>
      )}
    </li>
  )
}

function ColumnDropzone({
  columnId,
  cards,
  dndDisabled,
  canEdit,
  editingCardId,
  editCardForm,
  onStartEditCard,
  onChangeEditCardForm,
  onSaveEditCard,
  onCancelEditCard,
  onDeleteCard,
}: ColumnDropzoneProps) {
  const { setNodeRef } = useDroppable({
    id: `column:${columnId}`,
    data: {
      type: 'column',
      columnId,
    },
    disabled: dndDisabled,
  })

  return (
    <ul ref={setNodeRef} className="min-h-24 space-y-2 rounded-md border border-transparent p-1">
      <SortableContext items={cards.map((card) => `card:${card.id}`)} strategy={verticalListSortingStrategy}>
        {cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            disabled={dndDisabled}
            canEdit={canEdit}
            isEditing={editingCardId === card.id}
            editForm={editCardForm}
            onStartEdit={onStartEditCard}
            onChangeEditForm={onChangeEditCardForm}
            onSaveEdit={onSaveEditCard}
            onCancelEdit={onCancelEditCard}
            onDelete={onDeleteCard}
          />
        ))}
      </SortableContext>
    </ul>
  )
}

export function BoardPage() {
  const params = useParams()
  const boardId = params.boardId
  const queryClient = useQueryClient()
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)
  const canEdit = user ? user.role !== 'viewer' : false
  const toast = useToast()
  const { selectedColumnId, setSelectedColumnId } = useBoardUiStore()
  const {
    status: realtimeStatus,
    onlineUserIds,
    draggingUserIds,
    currentUserId,
    sendDraggingActivity,
  } = useBoardRealtimeSync(boardId)
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnTitle, setEditingColumnTitle] = useState('')
  const [cardSearch, setCardSearch] = useState('')
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editCardForm, setEditCardForm] = useState<EditCardForm>({
    title: '',
    description: '',
  })
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
  const visibleColumns = boardQuery.data ? filterSnapshotCards(boardQuery.data, cardSearch) : []
  const visibleCardsCount = visibleColumns.reduce((sum, column) => sum + column.cards.length, 0)
  const otherDraggingUsers = draggingUserIds.filter((userId) => userId !== currentUserId)

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
      toast.success('Column created')
    },
    onError: () => {
      toast.error('Failed to create column')
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
      toast.success('Card created')
    },
    onError: () => {
      toast.error('Failed to create card')
    },
  })

  const moveCardMutation = useMutation({
    mutationFn: (input: { cardId: string; columnId: string; position: number }) =>
      updateCard(input.cardId, { columnId: input.columnId, position: input.position }),
    onError: (_error, variables) => {
      if (boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
      toast.error('Failed to move card')
      console.error(`Failed to move card ${variables.cardId}`)
    },
  })

  const updateCardMutation = useMutation({
    mutationFn: (input: { cardId: string; title: string; description: string }) =>
      updateCard(input.cardId, {
        title: input.title,
        description: input.description,
      }),
    onSuccess: (updatedCard) => {
      if (!boardId) {
        return
      }

      queryClient.setQueryData<BoardSnapshot | undefined>(boardQueryKeys.detail(boardId), (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          columns: current.columns.map((column) => ({
            ...column,
            cards: sortByPosition(
              column.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
            ),
          })),
        }
      })

      setEditingCardId(null)
      setEditCardForm({ title: '', description: '' })
      toast.success('Card updated')
    },
    onError: () => {
      if (boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
      toast.error('Failed to update card')
    },
  })

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => deleteCard(cardId),
    onMutate: (cardId) => {
      if (!boardId) {
        return { previous: undefined as BoardSnapshot | undefined }
      }

      const previous = queryClient.getQueryData<BoardSnapshot>(boardQueryKeys.detail(boardId))
      queryClient.setQueryData<BoardSnapshot | undefined>(boardQueryKeys.detail(boardId), (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          columns: current.columns.map((column) => ({
            ...column,
            cards: column.cards.filter((card) => card.id !== cardId),
          })),
        }
      })

      return { previous }
    },
    onSuccess: () => {
      toast.success('Card deleted')
    },
    onError: (_error, _cardId, context) => {
      if (!boardId) {
        return
      }

      if (context?.previous) {
        queryClient.setQueryData(boardQueryKeys.detail(boardId), context.previous)
      } else {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
      toast.error('Failed to delete card')
    },
  })

  const updateColumnMutation = useMutation({
    mutationFn: (input: { columnId: string; title?: string; position?: number }) =>
      updateColumn(input.columnId, { title: input.title, position: input.position }),
    onSuccess: (updatedColumn, variables) => {
      if (!boardId) {
        return
      }

      queryClient.setQueryData<BoardSnapshot | undefined>(boardQueryKeys.detail(boardId), (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          columns: sortByPosition(
            current.columns.map((column) =>
              column.id === updatedColumn.id ? { ...column, ...updatedColumn } : column,
            ),
          ),
        }
      })
      if (variables.title !== undefined) {
        toast.success('Column renamed')
      }
    },
    onError: () => {
      if (boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      }
      toast.error('Failed to update column')
    },
  })

  const startRenameColumn = (columnId: string, currentTitle: string) => {
    setEditingColumnId(columnId)
    setEditingColumnTitle(currentTitle)
  }

  const cancelRenameColumn = () => {
    setEditingColumnId(null)
    setEditingColumnTitle('')
  }

  const submitRenameColumn = (columnId: string) => {
    const nextTitle = editingColumnTitle.trim()
    if (!nextTitle) {
      return
    }

    updateColumnMutation.mutate(
      { columnId, title: nextTitle },
      {
        onSuccess: () => {
          cancelRenameColumn()
        },
      },
    )
  }

  const moveColumn = (columnId: string, direction: 'left' | 'right') => {
    if (!boardId || !boardQuery.data) {
      return
    }

    const currentIndex = boardQuery.data.columns.findIndex((column) => column.id === columnId)
    if (currentIndex < 0) {
      return
    }

    const toIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
    const optimistic = reorderColumnOptimistic(boardQuery.data, { columnId, toIndex })
    if (!optimistic) {
      return
    }

    queryClient.setQueryData<BoardSnapshot>(boardQueryKeys.detail(boardId), optimistic.snapshot)
    updateColumnMutation.mutate({
      columnId,
      position: optimistic.movedColumn.position,
    })
  }

  const startEditCard = (card: BoardCard) => {
    setEditingCardId(card.id)
    setEditCardForm({
      title: card.title,
      description: card.description,
    })
  }

  const cancelEditCard = () => {
    setEditingCardId(null)
    setEditCardForm({ title: '', description: '' })
  }

  const submitEditCard = (cardId: string) => {
    const title = editCardForm.title.trim()
    if (!title) {
      return
    }

    updateCardMutation.mutate({
      cardId,
      title,
      description: editCardForm.description,
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    sendDraggingActivity(false)

    if (!canEdit || !boardId || !boardQuery.data || !event.over) {
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

  const handleDragStart = () => {
    if (!canEdit) {
      return
    }

    sendDraggingActivity(true)
  }

  const handleDragCancel = () => {
    sendDraggingActivity(false)
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
        <header className="flex items-start justify-between gap-4">
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
            {!canEdit ? (
              <p className="mt-2 text-xs text-amber-300">Viewer role: editing is disabled.</p>
            ) : null}
            {otherDraggingUsers.length > 0 ? (
              <p className="mt-2 text-xs text-violet-300">
                {otherDraggingUsers.length} collaborator
                {otherDraggingUsers.length > 1 ? 's' : ''} dragging
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            {user ? (
              <p className="text-xs text-slate-400">
                {user.name} ({user.role})
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => clearSession()}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
            >
              Sign out
            </button>
            <Link className="text-sm text-cyan-400 hover:text-cyan-300" to="/">
              Back to boards
            </Link>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={createColumnForm.handleSubmit((values) => {
              if (!canEdit) {
                return
              }

              createColumnMutation.mutate(values)
            })}
          >
            <input
              {...createColumnForm.register('title')}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500"
              placeholder="Column title"
            />
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canEdit || createColumnMutation.isPending}
            >
              Add column
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={createCardForm.handleSubmit((values) => {
              if (!canEdit) {
                return
              }

              createCardMutation.mutate(values)
            })}
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
              disabled={!canEdit || createCardMutation.isPending}
            >
              Add card
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={cardSearch}
              onChange={(event) => setCardSearch(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500 sm:max-w-sm"
              placeholder="Search cards by title or description"
              aria-label="Search cards"
            />
            <p className="text-xs text-slate-400">Visible cards: {visibleCardsCount}</p>
          </div>
        </section>

        {boardQuery.isLoading ? <p>Loading board snapshot...</p> : null}
        {boardQuery.isError ? <p className="text-rose-400">Failed to load board snapshot.</p> : null}

        <DndContext
          sensors={canEdit ? sensors : []}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleColumns.map((column, index, columns) => (
              <article key={column.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  {editingColumnId === column.id ? (
                    <div className="flex w-full items-center gap-2">
                      <input
                        value={editingColumnTitle}
                        onChange={(event) => setEditingColumnTitle(event.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                        aria-label={`Column title ${column.title}`}
                      />
                      <button
                        type="button"
                        onClick={() => submitRenameColumn(column.id)}
                        className="rounded-md border border-cyan-600 px-2 py-1 text-xs hover:border-cyan-500"
                        disabled={!canEdit || updateColumnMutation.isPending}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelRenameColumn}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-slate-500"
                        disabled={updateColumnMutation.isPending}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold">{column.title}</h2>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startRenameColumn(column.id, column.title)}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-cyan-500"
                            aria-label={`Rename ${column.title}`}
                            disabled={updateColumnMutation.isPending}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(column.id, 'left')}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-cyan-500 disabled:opacity-50"
                            aria-label={`Move ${column.title} left`}
                            disabled={index === 0 || updateColumnMutation.isPending}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(column.id, 'right')}
                            className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:border-cyan-500 disabled:opacity-50"
                            aria-label={`Move ${column.title} right`}
                            disabled={index === columns.length - 1 || updateColumnMutation.isPending}
                          >
                            →
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <ColumnDropzone
                  columnId={column.id}
                  cards={column.cards}
                  dndDisabled={!canEdit}
                  canEdit={canEdit}
                  editingCardId={editingCardId}
                  editCardForm={editCardForm}
                  onStartEditCard={startEditCard}
                  onChangeEditCardForm={setEditCardForm}
                  onSaveEditCard={submitEditCard}
                  onCancelEditCard={cancelEditCard}
                  onDeleteCard={(cardId) => deleteCardMutation.mutate(cardId)}
                />
              </article>
            ))}
          </section>
        </DndContext>
      </div>
    </main>
  )
}
