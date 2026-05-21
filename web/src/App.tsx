import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGate } from './components/AuthGate'
import { MainLayout } from './components/layout/MainLayout'
import { PrivateRoute } from './routes/PrivateRoute'
import { ErrorPage } from './pages/error/ErrorPage'
import { Placeholder } from './pages/Placeholder'
import { RoleRedirect } from './pages/RoleRedirect'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RoleRedirect />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/app',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <PrivateRoute allowedRoles={['client']} />,
        children: [
          { index: true, element: <Placeholder title="Client dashboard" /> },
          { path: 'setup', element: <Placeholder title="Street group setup" /> },
          { path: 'membership', element: <Placeholder title="Membership" /> },
          { path: 'membership/setup', element: <Placeholder title="Membership set-up" /> },
          { path: 'sharehire', element: <Placeholder title="Share / hire" /> },
          { path: 'mowers', element: <Placeholder title="Find a mower" /> },
          { path: 'user/:userId', element: <Placeholder title="User profile" /> },
          { path: 'user/:userId/edit', element: <Placeholder title="Edit profile" /> },
          { path: 'preferences', element: <Placeholder title="Preferences" /> },
          { path: 'account', element: <Placeholder title="Account settings" /> },
          { path: '*', element: <Placeholder title="Not found" /> },
        ],
      },
    ],
  },
  {
    path: '/mower',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <PrivateRoute allowedRoles={['mower']} />,
        children: [
          { index: true, element: <Placeholder title="Mower dashboard" /> },
          { path: 'setup', element: <Placeholder title="Mower set-up" /> },
          { path: 'streets', element: <Placeholder title="Open streets" /> },
          { path: 'history', element: <Placeholder title="Job history" /> },
          { path: 'user/:userId', element: <Placeholder title="User profile" /> },
          { path: 'user/:userId/edit', element: <Placeholder title="Edit profile" /> },
          { path: 'preferences', element: <Placeholder title="Preferences" /> },
          { path: 'account', element: <Placeholder title="Account settings" /> },
          { path: '*', element: <Placeholder title="Not found" /> },
        ],
      },
    ],
  },
  {
    path: '/mower/:mowerId',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <Placeholder title="Public mower profile" /> }],
  },
  {
    path: '/admin',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <PrivateRoute allowedRoles={['admin']} />,
        children: [
          { index: true, element: <Placeholder title="Admin dashboard" /> },
          { path: 'users', element: <Placeholder title="Users" /> },
          { path: 'users/:userId', element: <Placeholder title="User detail" /> },
          { path: 'groups', element: <Placeholder title="Street groups" /> },
          { path: '*', element: <Placeholder title="Not found" /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </AuthProvider>
  )
}
