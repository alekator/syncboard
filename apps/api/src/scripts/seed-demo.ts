import { randomUUID } from 'node:crypto'

import type { BoardRole } from '@syncboard/shared'

import { createDemoDataset } from './demo-seed-data.js'

type LoginResponse = {
  token: string
  user: {
    id: string
    name: string
    role: BoardRole
  }
}

type BoardResponse = {
  id: string
  name: string
}

type ColumnResponse = {
  id: string
  title: string
}

type Session = {
  userId: string
  name: string
  role: BoardRole
  token: string
}

const API_URL = process.env.SYNCBOARD_API_URL ?? 'http://localhost:3001'
const label = process.env.DEMO_LABEL ?? `Demo ${new Date().toISOString().slice(0, 10)}`

async function requestJson<T>(
  path: string,
  init?: RequestInit & {
    token?: string
  },
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status} ${payload}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function loginUser(name: string, role: BoardRole): Promise<Session> {
  const session = await requestJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, role }),
  })

  return {
    userId: session.user.id,
    name: session.user.name,
    role: session.user.role,
    token: session.token,
  }
}

async function createBoard(session: Session, name: string) {
  return requestJson<BoardResponse>('/boards', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ name }),
  })
}

async function createColumn(session: Session, boardId: string, title: string) {
  return requestJson<ColumnResponse>(`/boards/${boardId}/columns`, {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ title }),
  })
}

async function createCard(session: Session, columnId: string, title: string, description: string) {
  return requestJson(`/columns/${columnId}/cards`, {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ title, description }),
  })
}

async function addBoardMember(ownerSession: Session, boardId: string, memberSession: Session) {
  return requestJson<void>(`/boards/${boardId}/members`, {
    method: 'POST',
    token: ownerSession.token,
    body: JSON.stringify({
      userId: memberSession.userId,
      role: memberSession.role,
    }),
  })
}

async function run() {
  const runId = randomUUID().slice(0, 8)
  const dataset = createDemoDataset(`${label} ${runId}`)

  console.log(`Seeding SyncBoard demo data`)
  console.log(`API: ${API_URL}`)
  console.log(`Label: ${label}`)
  console.log(`Users: ${dataset.users.length}, Boards: ${dataset.boards.length}`)

  const sessions: Session[] = []
  for (const user of dataset.users) {
    const session = await loginUser(user.name, user.role)
    sessions.push(session)
    console.log(`- user: ${session.name} (${session.role})`)
  }

  const writableSessions = sessions.filter((session) => session.role !== 'viewer')
  if (writableSessions.length === 0) {
    throw new Error('No writable sessions available for seed.')
  }

  const boardSummaries: Array<{ id: string; name: string; columns: number; cards: number }> = []

  for (const [boardIndex, boardBlueprint] of dataset.boards.entries()) {
    const session = writableSessions[boardIndex % writableSessions.length]
    const board = await createBoard(session, boardBlueprint.name)
    for (const memberSession of sessions) {
      if (memberSession.userId === session.userId) {
        continue
      }

      await addBoardMember(session, board.id, memberSession)
    }

    let cardsCreated = 0
    for (const columnBlueprint of boardBlueprint.columns) {
      const column = await createColumn(session, board.id, columnBlueprint.title)
      for (const card of columnBlueprint.cards) {
        await createCard(session, column.id, card.title, card.description)
        cardsCreated += 1
      }
    }

    boardSummaries.push({
      id: board.id,
      name: board.name,
      columns: boardBlueprint.columns.length,
      cards: cardsCreated,
    })
    console.log(`- board: ${board.name} (${boardBlueprint.columns.length} columns, ${cardsCreated} cards)`)
  }

  const totalCards = boardSummaries.reduce((sum, board) => sum + board.cards, 0)
  console.log('')
  console.log(`Done. Created ${boardSummaries.length} boards and ${totalCards} cards.`)
  console.log('Board IDs:')
  for (const board of boardSummaries) {
    console.log(`  ${board.id}  ${board.name}`)
  }
}

run().catch((error) => {
  console.error('Demo seed failed')
  console.error(error)
  process.exitCode = 1
})
