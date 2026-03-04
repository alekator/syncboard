import type { BoardSnapshot } from '@syncboard/shared'

type ReorderColumnInput = {
  columnId: string
  toIndex: number
}

type ReorderColumnResult = {
  snapshot: BoardSnapshot
  movedColumn: BoardSnapshot['columns'][number]
}

const POSITION_GAP = 1_000

function sortColumns(columns: BoardSnapshot['columns']) {
  return [...columns].sort((a, b) => a.position - b.position)
}

function computePosition(columns: BoardSnapshot['columns'], toIndex: number) {
  if (columns.length === 0) {
    return POSITION_GAP
  }

  const previous = columns[toIndex - 1]
  const next = columns[toIndex]

  if (!previous && !next) {
    return POSITION_GAP
  }

  if (!previous && next) {
    return next.position / 2
  }

  if (previous && !next) {
    return previous.position + POSITION_GAP
  }

  if (!previous || !next) {
    return POSITION_GAP
  }

  const between = (previous.position + next.position) / 2
  if (Number.isFinite(between) && between !== previous.position && between !== next.position) {
    return between
  }

  return previous.position + 1
}

export function reorderColumnOptimistic(
  snapshot: BoardSnapshot,
  input: ReorderColumnInput,
): ReorderColumnResult | null {
  const sorted = sortColumns(snapshot.columns)
  const sourceIndex = sorted.findIndex((column) => column.id === input.columnId)
  if (sourceIndex < 0) {
    return null
  }

  const targetIndex = Math.max(0, Math.min(input.toIndex, sorted.length - 1))
  if (sourceIndex === targetIndex) {
    return null
  }

  const nextOrder = [...sorted]
  const [extracted] = nextOrder.splice(sourceIndex, 1)
  if (!extracted) {
    return null
  }

  const now = new Date().toISOString()
  const position = computePosition(nextOrder, targetIndex)
  const movedColumn: BoardSnapshot['columns'][number] = {
    ...extracted,
    position,
    updatedAt: now,
  }
  nextOrder.splice(targetIndex, 0, movedColumn)

  return {
    snapshot: {
      ...snapshot,
      columns: sortColumns(
        nextOrder.map((column) =>
          column.id === movedColumn.id ? movedColumn : column,
        ),
      ),
    },
    movedColumn,
  }
}
