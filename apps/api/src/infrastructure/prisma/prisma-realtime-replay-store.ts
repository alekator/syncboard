import { Prisma } from '@prisma/client'
import { realtimeEventEnvelopeSchema, type RealtimeEventEnvelope } from '@syncboard/shared'

import type { PrismaClient } from '@prisma/client'
import type { RealtimeReplayStore } from '../../realtime/replay-store.js'

const MAX_DURABLE_REPLAY_EVENTS_PER_BOARD = 5_000
const SEQUENCE_RETRY_ATTEMPTS = 5

type ReplayAppendInput = {
  boardId: string
  entityId?: string
  event: RealtimeEventEnvelope['event']
}

export class PrismaRealtimeReplayStore implements RealtimeReplayStore {
  constructor(private readonly prisma: PrismaClient) {}

  async append(input: ReplayAppendInput): Promise<RealtimeEventEnvelope> {
    let lastError: unknown

    for (let attempt = 0; attempt < SEQUENCE_RETRY_ATTEMPTS; attempt += 1) {
      const latest = await this.prisma.boardEvent.findFirst({
        where: { boardId: input.boardId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true, version: true },
      })

      const sequence = (latest?.sequence ?? 0) + 1
      const version = (latest?.version ?? 0) + 1
      const timestamp = new Date()

      try {
        const created = await this.prisma.boardEvent.create({
          data: {
            boardId: input.boardId,
            entityId: input.entityId,
            sequence,
            version,
            timestamp,
            event: input.event as Prisma.InputJsonValue,
          },
        })

        if (sequence % 100 === 0) {
          await this.prisma.boardEvent.deleteMany({
            where: {
              boardId: input.boardId,
              sequence: {
                lte: sequence - MAX_DURABLE_REPLAY_EVENTS_PER_BOARD,
              },
            },
          })
        }

        return realtimeEventEnvelopeSchema.parse({
          boardId: created.boardId,
          entityId: created.entityId ?? undefined,
          sequence: created.sequence,
          version: created.version,
          timestamp: created.timestamp.toISOString(),
          event: created.event,
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          lastError = error
          continue
        }
        throw error
      }
    }

    throw lastError ?? new Error('Failed to allocate board event sequence')
  }

  async getSince(boardId: string, fromSequence: number): Promise<RealtimeEventEnvelope[]> {
    const rows = await this.prisma.boardEvent.findMany({
      where: {
        boardId,
        sequence: {
          gt: fromSequence,
        },
      },
      orderBy: { sequence: 'asc' },
      take: MAX_DURABLE_REPLAY_EVENTS_PER_BOARD,
    })

    return rows.map((row) =>
      realtimeEventEnvelopeSchema.parse({
        boardId: row.boardId,
        entityId: row.entityId ?? undefined,
        sequence: row.sequence,
        version: row.version,
        timestamp: row.timestamp.toISOString(),
        event: row.event,
      }),
    )
  }
}
