import { expect, test } from '@playwright/test'

test('rename and delete board from boards page', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const boardName = `E2E Manage Board ${suffix}`
  const renamedBoardName = `E2E Renamed Board ${suffix}`

  await page.goto('/login')
  await page.getByPlaceholder('Your name').fill('E2E Manager')
  await page.getByRole('combobox').selectOption('owner')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'SyncBoard' })).toBeVisible()

  await page.getByPlaceholder('New board name').fill(boardName)
  await page.getByRole('button', { name: 'Create board' }).click()
  await expect(page.getByText(boardName)).toBeVisible()

  await page.getByRole('button', { name: `Rename ${boardName}`, exact: true }).click()
  await page.getByLabel(`Board name ${boardName}`).fill(renamedBoardName)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(renamedBoardName)).toBeVisible()
  await expect(page.getByText(boardName)).toHaveCount(0)

  await page.getByRole('button', { name: `Delete ${renamedBoardName}`, exact: true }).click()
  await expect(page.getByText(renamedBoardName)).toHaveCount(0)
})
