import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'

import { BoardPage } from '@/features/board/ui/board-page'
import { BoardsPage } from '@/features/boards/ui/boards-page'

const router = createBrowserRouter([
  {
    path: '/',
    element: <BoardsPage />,
  },
  {
    path: '/boards/:boardId',
    element: <BoardPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
