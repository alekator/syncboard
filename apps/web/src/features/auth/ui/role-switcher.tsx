import type { BoardRole } from '@syncboard/shared'

import { useRoleStore } from '@/features/auth/model/role-store'

const ROLE_OPTIONS: BoardRole[] = ['owner', 'editor', 'viewer']

export function RoleSwitcher() {
  const role = useRoleStore((state) => state.role)
  const setRole = useRoleStore((state) => state.setRole)

  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      Role
      <select
        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
        value={role}
        onChange={(event) => setRole(event.target.value as BoardRole)}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
