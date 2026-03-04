import { expect, test } from '@playwright/test'

test('filters cards by search text', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const boardName = `E2E Search Board ${suffix}`
  const columnName = `Search Column ${suffix}`
  const cardA = `Alpha ${suffix}`
  const cardB = `Beta ${suffix}`

  await page.goto('/login')
  await page.getByPlaceholder('Your name').fill('E2E Search User')
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

  await page.getByPlaceholder('Card title').fill(cardA)
  await page.getByRole('button', { name: 'Add card' }).click()
  await expect(page.getByText(cardA)).toBeVisible()

  await page.getByPlaceholder('Card title').fill(cardB)
  await page.getByPlaceholder('Description (optional)').fill('find-me')
  await page.getByRole('button', { name: 'Add card' }).click()
  await expect(page.getByText(cardB)).toBeVisible()

  await page.getByLabel('Search cards').fill('alpha')
  await expect(page.getByText(cardA)).toBeVisible()
  await expect(page.getByText(cardB)).toHaveCount(0)

  await page.getByLabel('Search cards').fill('find-me')
  await expect(page.getByText(cardB)).toBeVisible()
  await expect(page.getByText(cardA)).toHaveCount(0)

  await page.getByLabel('Search cards').fill('')
  await expect(page.getByText(cardA)).toBeVisible()
  await expect(page.getByText(cardB)).toBeVisible()
})
