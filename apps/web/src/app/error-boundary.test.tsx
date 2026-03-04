import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppErrorBoundary } from './error-boundary'

function CrashingComponent() {
  throw new Error('boom')
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders fallback UI when child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AppErrorBoundary>
        <CrashingComponent />
      </AppErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeVisible()
    expect(
      screen.getByText('The application crashed unexpectedly. Try reloading the page.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeVisible()
  })
})
