import { create } from 'zustand'
import { boardRoleSchema, type BoardRole } from '@syncboard/shared'

type RoleState = {
  role: BoardRole
  setRole: (role: BoardRole) => void
}

export const useRoleStore = create<RoleState>((set) => ({
  role: 'owner',
  setRole: (role) => {
    const safeRole = boardRoleSchema.parse(role)
    set({ role: safeRole })
  },
}))

export function getCurrentRole() {
  return useRoleStore.getState().role
}
