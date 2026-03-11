import { randomUUID } from 'node:crypto'
import type { AuthUser, BoardRole } from '@syncboard/shared'

export interface SessionStore {
  createSession(input: { name: string; role: BoardRole }): Promise<{ token: string; user: AuthUser }>
  getUserByToken(token: string): Promise<AuthUser | null>
  getUserById(userId: string): Promise<AuthUser | null>
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, AuthUser>()
  private readonly users = new Map<string, AuthUser>()

  async createSession(input: { name: string; role: BoardRole }) {
    const token = randomUUID()
    const user: AuthUser = {
      id: randomUUID(),
      name: input.name,
      role: input.role,
    }

    this.sessions.set(token, user)
    this.users.set(user.id, user)

    return {
      token,
      user,
    }
  }

  async getUserByToken(token: string) {
    return this.sessions.get(token) ?? null
  }

  async getUserById(userId: string) {
    return this.users.get(userId) ?? null
  }
}
