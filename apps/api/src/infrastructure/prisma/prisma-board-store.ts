import type { PrismaClient } from '@prisma/client'
import type { Board, BoardCard, BoardColumn, BoardSnapshot } from '@syncboard/shared'

import type { BoardStore } from '../../domain/board-store.js'

const POSITION_STEP = 1_000

function toIsoDate(value: Date) {
  return value.toISOString()
}

function mapBoard(board: {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}): Board {
  return {
    id: board.id,
    name: board.name,
    createdAt: toIsoDate(board.createdAt),
    updatedAt: toIsoDate(board.updatedAt),
  }
}

function mapColumn(column: {
  id: string
  boardId: string
  title: string
  position: number
  createdAt: Date
  updatedAt: Date
}): BoardColumn {
  return {
    id: column.id,
    boardId: column.boardId,
    title: column.title,
    position: column.position,
    createdAt: toIsoDate(column.createdAt),
    updatedAt: toIsoDate(column.updatedAt),
  }
}

function mapCard(card: {
  id: string
  boardId: string
  columnId: string
  title: string
  description: string
  position: number
  createdAt: Date
  updatedAt: Date
}): BoardCard {
  return {
    id: card.id,
    boardId: card.boardId,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    position: card.position,
    createdAt: toIsoDate(card.createdAt),
    updatedAt: toIsoDate(card.updatedAt),
  }
}

export class PrismaBoardStore implements BoardStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listBoards() {
    const boards = await this.prisma.board.findMany({
      orderBy: { createdAt: 'asc' },
    })

    return boards.map(mapBoard)
  }

  async createBoard(name: string) {
    const board = await this.prisma.board.create({
      data: { name },
    })

    return mapBoard(board)
  }

  async getBoard(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    })

    return board ? mapBoard(board) : null
  }

  async getCard(cardId: string) {
    const card = await this.prisma.boardCard.findUnique({
      where: { id: cardId },
    })

    return card ? mapCard(card) : null
  }

  async getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    })

    if (!board) {
      return null
    }

    return {
      board: mapBoard(board),
      columns: board.columns.map((column) => ({
        ...mapColumn(column),
        cards: column.cards.map(mapCard),
      })),
    }
  }

  async createColumn(boardId: string, title: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true },
    })

    if (!board) {
      return null
    }

    const lastColumn = await this.prisma.boardColumn.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const column = await this.prisma.boardColumn.create({
      data: {
        boardId,
        title,
        position: (lastColumn?.position ?? 0) + POSITION_STEP,
      },
    })

    return mapColumn(column)
  }

  async updateColumn(columnId: string, updates: { title?: string; position?: number }) {
    const existing = await this.prisma.boardColumn.findUnique({
      where: { id: columnId },
    })

    if (!existing) {
      return null
    }

    const column = await this.prisma.boardColumn.update({
      where: { id: columnId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.position !== undefined ? { position: updates.position } : {}),
      },
    })

    return mapColumn(column)
  }

  async createCard(columnId: string, input: { title: string; description?: string }) {
    const column = await this.prisma.boardColumn.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    })

    if (!column) {
      return null
    }

    const lastCard = await this.prisma.boardCard.findFirst({
      where: { columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const card = await this.prisma.boardCard.create({
      data: {
        boardId: column.boardId,
        columnId: column.id,
        title: input.title,
        description: input.description ?? '',
        position: (lastCard?.position ?? 0) + POSITION_STEP,
      },
    })

    return mapCard(card)
  }

  async updateCard(
    cardId: string,
    updates: { title?: string; description?: string; columnId?: string; position?: number },
  ) {
    const existing = await this.prisma.boardCard.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true },
    })

    if (!existing) {
      return null
    }

    if (updates.columnId !== undefined) {
      const targetColumn = await this.prisma.boardColumn.findUnique({
        where: { id: updates.columnId },
        select: { boardId: true },
      })

      if (!targetColumn || targetColumn.boardId !== existing.boardId) {
        return null
      }
    }

    const card = await this.prisma.boardCard.update({
      where: { id: cardId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.columnId !== undefined ? { columnId: updates.columnId } : {}),
        ...(updates.position !== undefined ? { position: updates.position } : {}),
      },
    })

    return mapCard(card)
  }

  async deleteCard(cardId: string) {
    const existing = await this.prisma.boardCard.findUnique({
      where: { id: cardId },
      select: { id: true },
    })

    if (!existing) {
      return false
    }

    await this.prisma.boardCard.delete({
      where: { id: cardId },
    })

    return true
  }
}
