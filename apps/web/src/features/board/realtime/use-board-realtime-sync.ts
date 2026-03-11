import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { BoardSnapshot, RealtimeEventEnvelope } from '@syncboard/shared'

import { boardQueryKeys } from '@/entities/board/api/query-keys'
import { useSessionStore } from '@/features/auth/model/session-store'
import { applyActivityEvent } from '@/features/board/realtime/activity'
import { applyRealtimeEventToSnapshot } from '@/features/board/realtime/apply-realtime-event'
import { applyPresenceEvent } from '@/features/board/realtime/presence'
import { nextRealtimeSequence, shouldApplyRealtimeSequence } from '@/features/board/realtime/sequence-gate'
import { RealtimeClient } from '@/shared/realtime/ws-client'

type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export function useBoardRealtimeSync(boardId: string | undefined) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [draggingByUser, setDraggingByUser] = useState<Record<string, boolean>>({})
  const sessionUser = useSessionStore((state) => state.user)
  const sessionToken = useSessionStore((state) => state.token)
  const currentUserId = sessionUser?.id
  const latestSequenceRef = useRef(0)
  const clientRef = useRef<RealtimeClient | null>(null)

  useEffect(() => {
    if (!boardId || !currentUserId || !sessionToken) {
      setStatus('disconnected')
      return
    }

    const client = new RealtimeClient({
      boardId,
      userId: currentUserId,
      token: sessionToken,
      onStateChange: setStatus,
      onConnected: () => {
        void queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(boardId) })
      },
      onEvent: (envelope: RealtimeEventEnvelope) => {
        if (envelope.boardId !== boardId) {
          return
        }

        if (!shouldApplyRealtimeSequence(latestSequenceRef.current, envelope.sequence)) {
          return
        }

        latestSequenceRef.current = nextRealtimeSequence(latestSequenceRef.current, envelope.sequence)
        setOnlineUserIds((previous) => applyPresenceEvent(previous, envelope))
        setDraggingByUser((previous) => applyActivityEvent(previous, envelope))

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
    clientRef.current = client

    client.connect()

    return () => {
      client.sendActivity(false)
      client.disconnect()
      clientRef.current = null
      latestSequenceRef.current = 0
      setStatus('disconnected')
      setOnlineUserIds([])
      setDraggingByUser({})
    }
  }, [boardId, currentUserId, queryClient, sessionToken])

  const visibleOnlineUserIds =
    currentUserId && onlineUserIds.includes(currentUserId)
      ? onlineUserIds
      : currentUserId
        ? [...onlineUserIds, currentUserId]
        : onlineUserIds

  const draggingUserIds = Object.keys(draggingByUser).filter((userId) => draggingByUser[userId])

  return {
    status,
    onlineUserIds: visibleOnlineUserIds,
    draggingUserIds,
    currentUserId: currentUserId ?? '',
    sendDraggingActivity: (dragging: boolean) => clientRef.current?.sendActivity(dragging),
  }
}
