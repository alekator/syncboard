import { randomUUID } from 'node:crypto'
import type { AuthUser, BoardRole } from '@syncboard/shared'

export class InMemorySessionStore {
  private readonly sessions = new Map<string, AuthUser>()

  createSession(input: { name: string; role: BoardRole }) {
    const token = randomUUID()
    const user: AuthUser = {
      id: randomUUID(),
      name: input.name,
      role: input.role,
    }

    this.sessions.set(token, user)

    return {
      token,
      user,
    }
  }

  getUserByToken(token: string) {
    return this.sessions.get(token) ?? null
  }
}
