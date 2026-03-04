import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import type { ReactElement } from 'react'

import { useSessionStore } from '@/features/auth/model/session-store'
import { LoginPage } from '@/features/auth/ui/login-page'
import { BoardPage } from '@/features/board/ui/board-page'
import { BoardsPage } from '@/features/boards/ui/boards-page'

function RequireAuth({ children }: { children: ReactElement }) {
  const token = useSessionStore((state) => state.token)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <BoardsPage />
      </RequireAuth>
    ),
  },
  {
    path: '/boards/:boardId',
    element: (
      <RequireAuth>
        <BoardPage />
      </RequireAuth>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
