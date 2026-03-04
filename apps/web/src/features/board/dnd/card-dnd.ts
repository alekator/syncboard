import type { BoardCard, BoardSnapshot } from '@syncboard/shared'

const POSITION_GAP = 1_000

type MoveCardInput = {
  cardId: string
  toColumnId: string
  overCardId?: string
}

type MoveCardResult = {
  snapshot: BoardSnapshot
  movedCard: BoardCard
}

function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    ...snapshot,
    columns: snapshot.columns.map((column) => ({
      ...column,
      cards: [...column.cards],
    })),
  }
}

function sortCards<T extends { position: number }>(cards: T[]) {
  return [...cards].sort((a, b) => a.position - b.position)
}

function computePosition(cards: BoardCard[], overCardId?: string) {
  const sorted = sortCards(cards)
  if (sorted.length === 0) {
    return POSITION_GAP
  }

  if (!overCardId) {
    return sorted[sorted.length - 1].position + POSITION_GAP
  }

  const overIndex = sorted.findIndex((card) => card.id === overCardId)
  if (overIndex < 0) {
    return sorted[sorted.length - 1].position + POSITION_GAP
  }

  const previous = sorted[overIndex - 1]
  const over = sorted[overIndex]

  if (!previous) {
    return over.position / 2
  }

  const between = (previous.position + over.position) / 2
  if (Number.isFinite(between) && between !== previous.position && between !== over.position) {
    return between
  }

  return over.position - 1
}

export function moveCardOptimistic(
  snapshot: BoardSnapshot,
  input: MoveCardInput,
): MoveCardResult | null {
  const next = cloneSnapshot(snapshot)
  let extractedCard: BoardCard | null = null

  next.columns = next.columns.map((column) => {
    const existing = column.cards.find((card) => card.id === input.cardId)
    if (!existing) {
      return column
    }

    extractedCard = existing
    return {
      ...column,
      cards: column.cards.filter((card) => card.id !== input.cardId),
    }
  })

  if (!extractedCard) {
    return null
  }
  const sourceCard: BoardCard = extractedCard

  const destinationColumn = next.columns.find((column) => column.id === input.toColumnId)
  if (!destinationColumn) {
    return null
  }

  const position = computePosition(destinationColumn.cards, input.overCardId)
  const movedCard: BoardCard = {
    ...sourceCard,
    columnId: input.toColumnId,
    position,
    updatedAt: new Date().toISOString(),
  }

  next.columns = next.columns.map((column) => {
    if (column.id !== destinationColumn.id) {
      return column
    }

    return {
      ...column,
      cards: sortCards([...column.cards, movedCard]),
    }
  })

  return {
    snapshot: next,
    movedCard,
  }
}
