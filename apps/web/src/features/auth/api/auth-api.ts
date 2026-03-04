import { loginBodySchema, loginResponseSchema, meResponseSchema } from '@syncboard/shared'

import { requestJson } from '@/shared/api/http-client'

export async function login(input: { name: string; role: 'owner' | 'editor' | 'viewer' }) {
  const body = loginBodySchema.parse(input)
  const payload = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return loginResponseSchema.parse(payload)
}

export async function getMe() {
  const payload = await requestJson('/me')
  return meResponseSchema.parse(payload)
}
