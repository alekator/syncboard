import { expect, test } from '@playwright/test'

test('ui state gallery renders key sections', async ({ page }) => {
  await page.goto('/__ui-states')

  await expect(page.getByRole('heading', { name: 'UI State Gallery' })).toBeVisible()
  await expect(page.getByText('Empty board')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Disconnected' })).toBeVisible()
  await expect(page.getByText('Task Card Variants')).toBeVisible()
  await expect(page.getByText('Toast / Banner Variants')).toBeVisible()
})
