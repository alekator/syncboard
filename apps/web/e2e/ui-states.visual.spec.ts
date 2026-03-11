import { expect, test } from '@playwright/test'

const FONT_NEUTRAL_STYLE = `
  h1, h2, h3, p, span, li, small, strong {
    color: transparent !important;
    text-shadow: none !important;
  }
`

test('ui state gallery visual regression baseline', async ({ page }) => {
  await page.goto('/__ui-states')
  await expect(page.getByRole('heading', { name: 'UI State Gallery' })).toBeVisible()

  // Neutralize font rendering differences across environments to keep visual diffs stable.
  await page.addStyleTag({ content: FONT_NEUTRAL_STYLE })

  await expect(page.locator('main')).toHaveScreenshot('ui-states-gallery-main.png', {
    animations: 'disabled',
    scale: 'css',
    caret: 'hide',
  })

  await expect(page.locator('section').first()).toHaveScreenshot('ui-states-gallery-critical-grid.png', {
    animations: 'disabled',
    scale: 'css',
    caret: 'hide',
  })
})
