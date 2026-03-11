import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UiStatesPage } from './ui-states-page'

describe('UiStatesPage', () => {
  it('renders key visual state sections', () => {
    render(<UiStatesPage />)

    expect(screen.getByRole('heading', { name: 'UI State Gallery' })).toBeVisible()
    expect(screen.getByText('Empty board')).toBeVisible()
    expect(screen.getByText('Loading board')).toBeVisible()
    expect(screen.getByText('Load error')).toBeVisible()
    expect(screen.getByText('Task Card Variants')).toBeVisible()
    expect(screen.getByText('Toast / Banner Variants')).toBeVisible()
  })
})
