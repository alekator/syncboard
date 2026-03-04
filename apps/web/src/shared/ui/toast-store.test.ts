import { beforeEach, describe, expect, it } from 'vitest'

import { useToastStore } from './toast-store'

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('pushes and removes toast items', () => {
    const { push, remove } = useToastStore.getState()
    const id = push({ message: 'Saved', variant: 'success' })

    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]).toEqual(
      expect.objectContaining({
        id,
        message: 'Saved',
        variant: 'success',
      }),
    )

    remove(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
