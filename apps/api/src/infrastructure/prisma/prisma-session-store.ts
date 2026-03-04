import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { AuthUser, BoardRole } from '@syncboard/shared'

import type { SessionStore } from '../../auth/session-store.js'

export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(input: { name: string; role: BoardRole }) {
    const token = randomUUID()

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
        },
      })

      await tx.session.create({
        data: {
          token,
          userId: user.id,
        },
      })

      return { token, user }
    })

    return {
      token: result.token,
      user: {
        id: result.user.id,
        name: result.user.name,
        role: input.role,
      } satisfies AuthUser,
    }
  }

  async getUserByToken(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session) {
      return null
    }

    const member = await this.prisma.boardMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true },
    })

    return {
      id: session.user.id,
      name: session.user.name,
      role: member?.role ?? 'owner',
    } satisfies AuthUser
  }
}
