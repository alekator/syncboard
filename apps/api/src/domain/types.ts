export type EntityId = string

export type Board = {
  id: EntityId
  name: string
  createdAt: string
  updatedAt: string
}

export type BoardColumn = {
  id: EntityId
  boardId: EntityId
  title: string
  position: number
  createdAt: string
  updatedAt: string
}

export type BoardCard = {
  id: EntityId
  boardId: EntityId
  columnId: EntityId
  title: string
  description: string
  position: number
  createdAt: string
  updatedAt: string
}

export type BoardSnapshot = {
  board: Board
  columns: Array<{
    id: EntityId
    boardId: EntityId
    title: string
    position: number
    createdAt: string
    updatedAt: string
    cards: BoardCard[]
  }>
}
