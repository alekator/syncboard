export const boardQueryKeys = {
  all: ['boards'] as const,
  list: () => ['boards', 'list'] as const,
  detail: (boardId: string) => ['boards', 'detail', boardId] as const,
}
