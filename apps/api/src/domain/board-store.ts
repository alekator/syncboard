import { randomUUID } from 'node:crypto'

import type { Board, BoardCard, BoardColumn, BoardSnapshot, EntityId } from './types.js'

const POSITION_STEP = 1_000

export class InMemoryBoardStore {
  private readonly boards = new Map<EntityId, Board>()
  private readonly columns = new Map<EntityId, BoardColumn>()
  private readonly cards = new Map<EntityId, BoardCard>()

  listBoards() {
    return [...this.boards.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  createBoard(name: string) {
    const now = new Date().toISOString()
    const board: Board = {
      id: randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    }

    this.boards.set(board.id, board)
    return board
  }

  getBoard(boardId: EntityId) {
    return this.boards.get(boardId) ?? null
  }

  getBoardSnapshot(boardId: EntityId): BoardSnapshot | null {
    const board = this.getBoard(boardId)
    if (!board) {
      return null
    }

    const boardColumns = [...this.columns.values()]
      .filter((column) => column.boardId === boardId)
      .sort((a, b) => a.position - b.position)
      .map((column) => ({
        ...column,
        cards: [...this.cards.values()]
          .filter((card) => card.columnId === column.id)
          .sort((a, b) => a.position - b.position),
      }))

    return {
      board,
      columns: boardColumns,
    }
  }

  createColumn(boardId: EntityId, title: string) {
    const board = this.boards.get(boardId)
    if (!board) {
      return null
    }

    const now = new Date().toISOString()
    const lastPosition = this.findLastColumnPosition(boardId)

    const column: BoardColumn = {
      id: randomUUID(),
      boardId,
      title,
      position: lastPosition + POSITION_STEP,
      createdAt: now,
      updatedAt: now,
    }

    this.columns.set(column.id, column)
    board.updatedAt = now
    return column
  }

  updateColumn(columnId: EntityId, updates: { title?: string; position?: number }) {
    const column = this.columns.get(columnId)
    if (!column) {
      return null
    }

    const now = new Date().toISOString()

    if (updates.title !== undefined) {
      column.title = updates.title
    }

    if (updates.position !== undefined) {
      column.position = updates.position
    }

    column.updatedAt = now
    const board = this.boards.get(column.boardId)
    if (board) {
      board.updatedAt = now
    }

    return column
  }

  createCard(columnId: EntityId, input: { title: string; description?: string }) {
    const column = this.columns.get(columnId)
    if (!column) {
      return null
    }

    const now = new Date().toISOString()
    const lastPosition = this.findLastCardPosition(columnId)

    const card: BoardCard = {
      id: randomUUID(),
      boardId: column.boardId,
      columnId,
      title: input.title,
      description: input.description ?? '',
      position: lastPosition + POSITION_STEP,
      createdAt: now,
      updatedAt: now,
    }

    this.cards.set(card.id, card)
    this.touchBoard(column.boardId, now)
    return card
  }

  updateCard(
    cardId: EntityId,
    updates: { title?: string; description?: string; columnId?: string; position?: number },
  ) {
    const card = this.cards.get(cardId)
    if (!card) {
      return null
    }

    const now = new Date().toISOString()

    if (updates.columnId !== undefined) {
      const targetColumn = this.columns.get(updates.columnId)
      if (!targetColumn || targetColumn.boardId !== card.boardId) {
        return null
      }

      card.columnId = updates.columnId
    }

    if (updates.title !== undefined) {
      card.title = updates.title
    }

    if (updates.description !== undefined) {
      card.description = updates.description
    }

    if (updates.position !== undefined) {
      card.position = updates.position
    }

    card.updatedAt = now
    this.touchBoard(card.boardId, now)
    return card
  }

  deleteCard(cardId: EntityId) {
    const card = this.cards.get(cardId)
    if (!card) {
      return false
    }

    this.cards.delete(cardId)
    this.touchBoard(card.boardId)
    return true
  }

  private findLastColumnPosition(boardId: EntityId) {
    return [...this.columns.values()]
      .filter((column) => column.boardId === boardId)
      .reduce((max, column) => Math.max(max, column.position), 0)
  }

  private findLastCardPosition(columnId: EntityId) {
    return [...this.cards.values()]
      .filter((card) => card.columnId === columnId)
      .reduce((max, card) => Math.max(max, card.position), 0)
  }

  private touchBoard(boardId: EntityId, now = new Date().toISOString()) {
    const board = this.boards.get(boardId)
    if (board) {
      board.updatedAt = now
    }
  }
}
