import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { BoardSnapshot, RealtimeEventEnvelope } from '@syncboard/shared'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { applyRealtimeEventToSnapshot } from '@/features/board/realtime/apply-realtime-event'
import { applyPresenceEvent } from '@/features/board/realtime/presence'
import { RealtimeClient } from '@/shared/realtime/ws-client'

type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export function useBoardRealtimeSync(boardId: string | undefined) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [currentUserId] = useState(() => crypto.randomUUID())
  const latestSequenceRef = useRef(0)

  useEffect(() => {
    if (!boardId) {
      return
    }

    const client = new RealtimeClient({
      boardId,
      userId: currentUserId,
      onStateChange: setStatus,
      onConnected: () => {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      },
      onEvent: (envelope: RealtimeEventEnvelope) => {
        if (envelope.boardId !== boardId) {
          return
        }

        if (envelope.sequence <= latestSequenceRef.current) {
          return
        }

        latestSequenceRef.current = envelope.sequence
        setOnlineUserIds((previous) => applyPresenceEvent(previous, envelope))

        queryClient.setQueryData<BoardSnapshot | undefined>(
          boardQueryKeys.detail(boardId),
          (current) => {
            if (!current) {
              return current
            }

            return applyRealtimeEventToSnapshot(current, envelope)
          },
        )
      },
    })

    client.connect()

    return () => {
      client.disconnect()
      latestSequenceRef.current = 0
      setStatus('disconnected')
      setOnlineUserIds([])
    }
  }, [boardId, currentUserId, queryClient])
  const visibleOnlineUserIds = onlineUserIds.includes(currentUserId)
    ? onlineUserIds
    : [...onlineUserIds, currentUserId]

  return { status, onlineUserIds: visibleOnlineUserIds, currentUserId }
}
