import { expect, test } from '@playwright/test'

test('edit and delete card from board UI', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const boardName = `E2E Edit Board ${suffix}`
  const columnName = `Column ${suffix}`
  const cardName = `Card ${suffix}`
  const updatedCardName = `Card Updated ${suffix}`

  await page.goto('/login')
  await page.getByPlaceholder('Your name').fill('E2E Owner')
  await page.getByRole('combobox').selectOption('owner')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'SyncBoard' })).toBeVisible()

  await page.getByPlaceholder('New board name').fill(boardName)
  await page.getByRole('button', { name: 'Create board' }).click()
  await page.getByRole('link', { name: boardName }).click()
  await expect(page.getByRole('heading', { name: boardName })).toBeVisible()

  await page.getByPlaceholder('Column title').fill(columnName)
  await page.getByRole('button', { name: 'Add column' }).click()
  await expect(page.getByRole('heading', { name: columnName })).toBeVisible()

  await page.getByPlaceholder('Card title').fill(cardName)
  await page.getByRole('button', { name: 'Add card' }).click()
  await expect(page.getByText(cardName)).toBeVisible()

  await page.getByRole('button', { name: `Edit ${cardName}`, exact: true }).click()
  await page.getByLabel(`Card title ${cardName}`).fill(updatedCardName)
  await page.getByLabel(`Card description ${cardName}`).fill('Updated from e2e')
  const updateCardResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && /\/cards\/[^/]+$/.test(response.url()) && response.status() === 200,
  )
  await page.getByRole('button', { name: 'Save card' }).click({ force: true })
  await updateCardResponsePromise

  await expect(page.getByText(updatedCardName)).toBeVisible()
  await expect(page.getByText(cardName)).toHaveCount(0)

  const deleteCardResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && /\/cards\/[^/]+$/.test(response.url()),
  )
  await page.getByRole('button', { name: `Delete ${updatedCardName}`, exact: true }).click()
  const deleteCardResponse = await deleteCardResponsePromise
  expect(deleteCardResponse.status()).toBe(204)
  await expect(page.getByText(updatedCardName)).toHaveCount(0)
})
