import { authUserSchema, type AuthUser } from '@syncboard/shared'
import { create } from 'zustand'

const TOKEN_KEY = 'syncboard.token'
const USER_KEY = 'syncboard.user'

function readStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorageValue(key: string, value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch {
    // Ignore storage write errors in restricted environments.
  }
}

function readInitialUser(): AuthUser | null {
  const raw = readStorageValue(USER_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return authUserSchema.parse(parsed)
  } catch {
    return null
  }
}

type SessionState = {
  token: string | null
  user: AuthUser | null
  setSession: (session: { token: string; user: AuthUser }) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  token: readStorageValue(TOKEN_KEY),
  user: readInitialUser(),
  setSession: (session) => {
    writeStorageValue(TOKEN_KEY, session.token)
    writeStorageValue(USER_KEY, JSON.stringify(session.user))
    set(session)
  },
  clearSession: () => {
    writeStorageValue(TOKEN_KEY, null)
    writeStorageValue(USER_KEY, null)
    set({ token: null, user: null })
  },
}))

export function getSessionSnapshot() {
  return useSessionStore.getState()
}
