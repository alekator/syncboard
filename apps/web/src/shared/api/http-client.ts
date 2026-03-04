import { getSessionSnapshot } from '@/features/auth/model/session-store'

const DEFAULT_API_URL = 'http://localhost:3001'

function buildUrl(path: string) {
  const apiUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL
  return `${apiUrl}${path}`
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSessionSnapshot()

  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session.user?.role ? { 'x-syncboard-role': session.user.role } : {}),
      ...(session.token ? { authorization: `Bearer ${session.token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
