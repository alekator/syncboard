import { z } from 'zod'

export const boardRoleSchema = z.enum(['owner', 'editor', 'viewer'])
export type BoardRole = z.infer<typeof boardRoleSchema>

export const authUserSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  role: boardRoleSchema,
})

export type AuthUser = z.infer<typeof authUserSchema>

export const loginBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: boardRoleSchema,
})

export type LoginBody = z.infer<typeof loginBodySchema>

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
})

export type LoginResponse = z.infer<typeof loginResponseSchema>

export const meResponseSchema = z.object({
  user: authUserSchema,
})

export type MeResponse = z.infer<typeof meResponseSchema>
