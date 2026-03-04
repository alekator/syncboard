import { expect, test } from '@playwright/test'

test('login, create board, create card, move card between columns', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const boardName = `E2E Board ${suffix}`
  const cardName = `E2E Card ${suffix}`

  await page.goto('/login')
  await page.getByPlaceholder('Your name').fill('E2E User')
  await page.getByRole('combobox').selectOption('owner')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'SyncBoard' })).toBeVisible()

  await page.getByPlaceholder('New board name').fill(boardName)
  await page.getByRole('button', { name: 'Create board' }).click()
  await page.getByRole('link', { name: boardName }).click()

  await expect(page.getByRole('heading', { name: boardName })).toBeVisible()

  await page.getByPlaceholder('Column title').fill('Backlog')
  const backlogColumnResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/boards\/[^/]+\/columns$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Add column' }).click()
  await backlogColumnResponsePromise
  await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible()

  await page.getByPlaceholder('Column title').fill('Doing')
  const doingColumnResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/boards\/[^/]+\/columns$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Add column' }).click()
  const doingColumnResponse = await doingColumnResponsePromise
  const doingColumnPayload = (await doingColumnResponse.json()) as { id: string }
  await expect(page.getByRole('heading', { name: 'Doing' })).toBeVisible()

  await page.getByPlaceholder('Card title').fill(cardName)
  const boardRefetchAfterCreatePromise = page.waitForResponse(
    (response) => response.request().method() === 'GET' && /\/boards\/[^/]+$/.test(response.url()),
  )
  const createCardResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && /\/columns\/[^/]+\/cards$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Add card' }).click()
  const createCardResponse = await createCardResponsePromise
  const createdCard = (await createCardResponse.json()) as { id: string }
  await boardRefetchAfterCreatePromise

  const backlogColumn = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Backlog' }),
  })
  const doingColumn = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Doing' }),
  })

  const cardInBacklog = backlogColumn.getByText(cardName)
  await expect(cardInBacklog).toBeVisible()

  const authToken = await page.evaluate(() => window.localStorage.getItem('syncboard.token'))
  await page.request.patch(`http://127.0.0.1:3001/cards/${createdCard.id}`, {
    data: {
      columnId: doingColumnPayload.id,
      position: 1500,
    },
    headers: {
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      'x-syncboard-role': 'owner',
      'content-type': 'application/json',
    },
  })

  await expect(doingColumn.getByText(cardName)).toBeVisible()
  await expect(backlogColumn.getByText(cardName)).toHaveCount(0)
})
