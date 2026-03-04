import { describe, expect, it } from 'vitest'

import { createDemoDataset } from './demo-seed-data.js'

describe('createDemoDataset', () => {
  it('creates a non-empty demo dataset with stable structure', () => {
    const dataset = createDemoDataset('Demo')

    expect(dataset.users).toHaveLength(5)
    expect(dataset.boards).toHaveLength(6)
    expect(dataset.boards[0].columns).toHaveLength(6)
    expect(dataset.boards[0].columns[0].cards.length).toBeGreaterThan(0)
    expect(dataset.boards[0].columns[4]?.title).toBe('Testing')
    expect(dataset.boards[0].columns[5]?.title).toBe('Done')
  })

  it('generates unique board names for screenshot-friendly data', () => {
    const dataset = createDemoDataset('Demo')
    const names = dataset.boards.map((board) => board.name)
    const unique = new Set(names)

    expect(unique.size).toBe(names.length)
  })
})
