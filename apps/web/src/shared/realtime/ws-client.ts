import { realtimeEventEnvelopeSchema, type RealtimeEventEnvelope } from '@syncboard/shared'

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

type RealtimeClientOptions = {
  boardId: string
  userId: string
  token: string
  onEvent: (event: RealtimeEventEnvelope) => void
  onStateChange?: (state: ConnectionState) => void
  onConnected?: () => void
}

function resolveRealtimeUrl(token: string) {
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (wsUrl) {
    return `${wsUrl}?token=${encodeURIComponent(token)}`
  }

  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'
  const fallbackWsUrl = apiUrl.replace(/^http/, 'ws')
  return `${fallbackWsUrl}/ws?token=${encodeURIComponent(token)}`
}

export class RealtimeClient {
  private readonly boardId: string
  private readonly onEvent: RealtimeClientOptions['onEvent']
  private readonly onStateChange?: RealtimeClientOptions['onStateChange']
  private readonly onConnected?: RealtimeClientOptions['onConnected']
  private readonly url: string

  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private isStopped = false
  private lastSequence = 0

  constructor(options: RealtimeClientOptions) {
    this.boardId = options.boardId
    this.onEvent = options.onEvent
    this.onStateChange = options.onStateChange
    this.onConnected = options.onConnected
    this.url = resolveRealtimeUrl(options.token)
  }

  connect() {
    if (this.isStopped) {
      return
    }

    this.onStateChange?.(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting')

    const socket = new WebSocket(this.url)
    this.socket = socket

    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0
      this.onStateChange?.('connected')
      this.joinBoard()
      this.onConnected?.()
    })

    socket.addEventListener('message', (message) => {
      try {
        const payload = JSON.parse(String(message.data))
        const parsed = realtimeEventEnvelopeSchema.safeParse(payload)
        if (parsed.success) {
          this.lastSequence = Math.max(this.lastSequence, parsed.data.sequence)
          this.onEvent(parsed.data)
        }
      } catch {
        // Ignore malformed payloads.
      }
    })

    socket.addEventListener('close', () => {
      this.socket = null

      if (this.isStopped) {
        this.onStateChange?.('disconnected')
        return
      }

      this.scheduleReconnect()
    })
  }

  disconnect() {
    this.isStopped = true

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.sendActivity(false)
    this.leaveBoard()
    this.socket?.close()
    this.socket = null
    this.onStateChange?.('disconnected')
  }

  private joinBoard() {
    this.send({
      type: 'board.join',
      boardId: this.boardId,
      fromSequence: this.lastSequence > 0 ? this.lastSequence : undefined,
    })
  }

  private leaveBoard() {
    this.send({
      type: 'board.leave',
      boardId: this.boardId,
    })
  }

  sendActivity(dragging: boolean) {
    this.send({
      type: 'activity.update',
      boardId: this.boardId,
      dragging,
    })
  }

  private send(payload: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return
    }

    this.socket.send(JSON.stringify(payload))
  }

  private scheduleReconnect() {
    this.reconnectAttempt += 1
    const delayMs = Math.min(10_000, 500 * 2 ** Math.min(this.reconnectAttempt, 4))

    this.reconnectTimer = window.setTimeout(() => {
      this.connect()
    }, delayMs)
  }
}
