export interface PresenceStore {
  markOnline(boardId: string, userId: string): Promise<void>
  markOffline(boardId: string, userId: string): Promise<void>
  listOnline(boardId: string): Promise<string[]>
}

export class InMemoryPresenceStore implements PresenceStore {
  private readonly boardUsers = new Map<string, Set<string>>()

  async markOnline(boardId: string, userId: string) {
    const users = this.boardUsers.get(boardId) ?? new Set<string>()
    users.add(userId)
    this.boardUsers.set(boardId, users)
  }

  async markOffline(boardId: string, userId: string) {
    const users = this.boardUsers.get(boardId)
    if (!users) {
      return
    }

    users.delete(userId)
    if (users.size === 0) {
      this.boardUsers.delete(boardId)
    }
  }

  async listOnline(boardId: string) {
    const users = this.boardUsers.get(boardId)
    if (!users) {
      return []
    }

    return [...users].sort((a, b) => a.localeCompare(b))
  }
}
