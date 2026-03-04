import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from './app.js'

describe('buildApp', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined

  afterEach(async () => {
    if (app) {
      await app.close()
      app = undefined
    }
  })

  it('returns health status for /health', async () => {
    app = await buildApp({ origin: '*' })

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})
