import { expect, test } from '@playwright/test'

async function login(page: import('@playwright/test').Page, name: string, role: 'owner' | 'editor') {
  await page.goto('/login')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in to SyncBoard' })).toBeVisible()

  await page.getByPlaceholder('Your name').fill(name)
  await page.getByRole('combobox').selectOption(role)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'SyncBoard' })).toBeVisible()
}

test('a11y smoke: login, boards and board screens expose key landmarks and controls', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in to SyncBoard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByPlaceholder('Your name')).toBeFocused()

  await login(page, 'A11y User', 'owner')

  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Boards' })).toBeVisible()
  await expect(page.getByPlaceholder('New board name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create board' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  const suffix = Date.now().toString().slice(-6)
  const boardName = `A11y Board ${suffix}`
  await page.getByPlaceholder('New board name').fill(boardName)
  await page.getByRole('button', { name: 'Create board' }).click()
  await page.getByRole('link', { name: boardName }).click()

  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: boardName })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to boards' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add column' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add card' })).toBeVisible()
  await expect(page.getByLabel('Search cards')).toBeVisible()
})
