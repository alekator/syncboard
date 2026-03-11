import { expect, test } from '@playwright/test'

async function login(page: import('@playwright/test').Page, name: string, role: 'owner' | 'editor') {
  await page.goto('/login')
  await page.getByPlaceholder('Your name').fill(name)
  await page.getByRole('combobox').selectOption(role)
  const loginResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/auth/login'),
  )
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'SyncBoard' })).toBeVisible()
  const loginResponse = await loginResponsePromise
  const payload = (await loginResponse.json()) as {
    token: string
    user: { id: string }
  }

  return {
    token: payload.token,
    userId: payload.user.id,
  }
}

async function addBoardMember(
  ownerPage: import('@playwright/test').Page,
  ownerToken: string,
  boardId: string,
  userId: string,
  role: 'owner' | 'editor' | 'viewer',
) {
  const response = await ownerPage.request.post(`http://localhost:3001/boards/${boardId}/members`, {
    headers: {
      authorization: `Bearer ${ownerToken}`,
      'content-type': 'application/json',
    },
    data: { userId, role },
  })

  expect(response.ok()).toBeTruthy()
}

test('realtime sync works between two sessions', async ({ browser }) => {
  const suffix = Date.now().toString().slice(-6)
  const boardName = `E2E Shared Board ${suffix}`
  const columnName = `Shared ${suffix}`
  const cardName = `Shared Card ${suffix}`

  const ownerContext = await browser.newContext()
  const editorContext = await browser.newContext()

  try {
    const ownerPage = await ownerContext.newPage()
    const editorPage = await editorContext.newPage()

    const ownerSession = await login(ownerPage, 'Owner User', 'owner')

    await ownerPage.getByPlaceholder('New board name').fill(boardName)
    await ownerPage.getByRole('button', { name: 'Create board' }).click()
    await ownerPage.getByRole('link', { name: boardName }).click()
    await expect(ownerPage.getByRole('heading', { name: boardName })).toBeVisible()

    const editorSession = await login(editorPage, 'Editor User', 'editor')

    const boardId = ownerPage.url().split('/boards/')[1]
    expect(boardId).toBeTruthy()
    await addBoardMember(ownerPage, ownerSession.token, boardId!, editorSession.userId, 'editor')

    await editorPage.reload()
    await expect(editorPage.getByRole('link', { name: boardName })).toBeVisible({ timeout: 15_000 })
    await editorPage.getByRole('link', { name: boardName }).click()
    await expect(editorPage.getByRole('heading', { name: boardName })).toBeVisible({ timeout: 15_000 })

    await ownerPage.getByPlaceholder('Column title').fill(columnName)
    const createColumnResponsePromise = ownerPage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && /\/boards\/[^/]+\/columns$/.test(response.url()),
    )
    await ownerPage.getByRole('button', { name: 'Add column' }).click()
    await createColumnResponsePromise

    await expect(ownerPage.getByRole('heading', { name: columnName })).toBeVisible()
    await expect(editorPage.getByRole('heading', { name: columnName })).toBeVisible({ timeout: 15_000 })

    await ownerPage.getByPlaceholder('Card title').fill(cardName)
    const createCardResponsePromise = ownerPage.waitForResponse(
      (response) => response.request().method() === 'POST' && /\/columns\/[^/]+\/cards$/.test(response.url()),
    )
    await ownerPage.getByRole('button', { name: 'Add card' }).click()
    await createCardResponsePromise

    await expect(ownerPage.getByText(cardName)).toBeVisible()
    await expect(editorPage.getByText(cardName)).toBeVisible({ timeout: 15_000 })
  } finally {
    await ownerContext.close()
    await editorContext.close()
  }
})
