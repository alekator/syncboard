import type { BoardSnapshot, RealtimeEventEnvelope } from '@syncboard/shared'

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position)
}

export function applyRealtimeEventToSnapshot(
  snapshot: BoardSnapshot,
  envelope: RealtimeEventEnvelope,
) {
  const current: BoardSnapshot = {
    ...snapshot,
    columns: snapshot.columns.map((column) => ({
      ...column,
      cards: [...column.cards],
    })),
  }

  const event = envelope.event

  if (event.type === 'column.created') {
    const exists = current.columns.some((column) => column.id === event.payload.id)
    if (exists) {
      return current
    }

    current.columns = sortByPosition([...current.columns, { ...event.payload, cards: [] }])
    return current
  }

  if (event.type === 'column.updated') {
    current.columns = sortByPosition(
      current.columns.map((column) =>
        column.id === event.payload.id ? { ...column, ...event.payload } : column,
      ),
    )
    return current
  }

  if (event.type === 'card.created') {
    current.columns = current.columns.map((column) => {
      if (column.id !== event.payload.columnId) {
        return column
      }

      const exists = column.cards.some((card) => card.id === event.payload.id)
      if (exists) {
        return column
      }

      return {
        ...column,
        cards: sortByPosition([...column.cards, event.payload]),
      }
    })
    return current
  }

  if (event.type === 'card.updated') {
    current.columns = current.columns.map((column) => {
      const hasCard = column.cards.some((card) => card.id === event.payload.id)
      if (!hasCard) {
        return column
      }

      return {
        ...column,
        cards: sortByPosition(
          column.cards.map((card) => (card.id === event.payload.id ? event.payload : card)),
        ),
      }
    })
    return current
  }

  if (event.type === 'card.moved') {
    let movedCard = current.columns
      .flatMap((column) => column.cards)
      .find((card) => card.id === event.payload.id)

    current.columns = current.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => card.id !== event.payload.id),
    }))

    if (!movedCard) {
      return current
    }

    movedCard = {
      ...movedCard,
      columnId: event.payload.columnId,
      position: event.payload.position,
      updatedAt: event.payload.updatedAt,
    }

    current.columns = current.columns.map((column) => {
      if (column.id !== movedCard.columnId) {
        return column
      }

      return {
        ...column,
        cards: sortByPosition([...column.cards, movedCard]),
      }
    })

    return current
  }

  if (event.type === 'card.deleted') {
    current.columns = current.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => card.id !== event.payload.id),
    }))
    return current
  }

  return current
}
