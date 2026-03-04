import { create } from 'zustand'

type BoardUiState = {
  selectedColumnId: string | null
  setSelectedColumnId: (columnId: string | null) => void
}

export const useBoardUiStore = create<BoardUiState>((set) => ({
  selectedColumnId: null,
  setSelectedColumnId: (selectedColumnId) => set({ selectedColumnId }),
}))
