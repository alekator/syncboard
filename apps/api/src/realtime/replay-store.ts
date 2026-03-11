import { realtimeEventEnvelopeSchema, type RealtimeEventEnvelope } from '@syncboard/shared'

type ReplayAppendInput = {
  boardId: string
  entityId?: string
  event: RealtimeEventEnvelope['event']
}

export interface RealtimeReplayStore {
  append(input: ReplayAppendInput): Promise<RealtimeEventEnvelope>
  getSince(boardId: string, fromSequence: number): Promise<RealtimeEventEnvelope[]>
}

const MAX_REPLAY_EVENTS_PER_BOARD = 500

export class InMemoryRealtimeReplayStore implements RealtimeReplayStore {
  private readonly sequenceByBoard = new Map<string, number>()
  private readonly versionByBoard = new Map<string, number>()
  private readonly replayByBoard = new Map<string, RealtimeEventEnvelope[]>()

  async append(input: ReplayAppendInput): Promise<RealtimeEventEnvelope> {
    const sequence = (this.sequenceByBoard.get(input.boardId) ?? 0) + 1
    const version = (this.versionByBoard.get(input.boardId) ?? 0) + 1

    this.sequenceByBoard.set(input.boardId, sequence)
    this.versionByBoard.set(input.boardId, version)

    const envelope = realtimeEventEnvelopeSchema.parse({
      boardId: input.boardId,
      entityId: input.entityId,
      sequence,
      version,
      timestamp: new Date().toISOString(),
      event: input.event,
    })

    const events = this.replayByBoard.get(input.boardId) ?? []
    events.push(envelope)
    if (events.length > MAX_REPLAY_EVENTS_PER_BOARD) {
      events.splice(0, events.length - MAX_REPLAY_EVENTS_PER_BOARD)
    }
    this.replayByBoard.set(input.boardId, events)

    return envelope
  }

  async getSince(boardId: string, fromSequence: number): Promise<RealtimeEventEnvelope[]> {
    const events = this.replayByBoard.get(boardId)
    if (!events || events.length === 0) {
      return []
    }

    return events.filter((event) => event.sequence > fromSequence)
  }
}
