import type { BoardSnapshot } from '@syncboard/shared'

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function filterSnapshotCards(
  snapshot: BoardSnapshot,
  query: string,
): BoardSnapshot['columns'] {
  const needle = normalize(query)
  if (!needle) {
    return snapshot.columns
  }

  return snapshot.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => {
      const title = normalize(card.title)
      const description = normalize(card.description)
      return title.includes(needle) || description.includes(needle)
    }),
  }))
}
