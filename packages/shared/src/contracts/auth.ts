import { z } from 'zod'

export const boardRoleSchema = z.enum(['owner', 'editor', 'viewer'])
export type BoardRole = z.infer<typeof boardRoleSchema>
