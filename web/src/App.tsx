import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGate } from './components/AuthGate'
import { MainLayout } from './components/layout/MainLayout'
import { PrivateRoute } from './routes/PrivateRoute'
import { ErrorPage } from './pages/error/ErrorPage'
import { Placeholder } from './pages/Placeholder'
import { RoleRedirect } from './pages/RoleRedirect'

// Client pages
import DashboardPage from './pages/UserInfoPage/DashboardPage'
import StreetGroupSetupPage from './pages/StreetGroup/StreetGroupSetupPage'
import MembershipPage from './pages/UserInfoPage/MembershipPage'
import MembershipSetupPage from './pages/UserInfoPage/MembershipSetupPage'
import ShareHirePage from './pages/UserInfoPage/ShareHirePage'
import MowersPage from './pages/UserInfoPage/MowersPage'
import GroupManagementPage from './pages/UserInfoPage/GroupManagementPage'
import UserProfilePage from './pages/UserProfile/UserProfilePage'
import UserProfileEditPage from './pages/UserProfile/UserProfileEditPage'
import UserPreferencesPage from './pages/UserProfile/UserPreferencesPage'
import AccountSettingsPage from './pages/UserProfile/AccountSettingsPage'

// Mower and admin pages load on demand (#31): a homeowner, the most common
// visitor, never downloads them. MainLayout's <Suspense> shows the fallback.
// Mower pages
const MowerDashboardPage = lazy(() => import('./pages/mower/MowerDashboardPage'))
const MowerSetupPage = lazy(() => import('./pages/mower/MowerSetupPage'))
const MowerStreetsPage = lazy(() => import('./pages/mower/MowerStreetsPage'))
const MowerHistoryPage = lazy(() => import('./pages/mower/MowerHistoryPage'))
const MowerPublicProfile = lazy(() => import('./pages/mower/MowerPublicProfile'))

// Admin pages (flattened from admin/src)
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'))
const AdminGroupsPage = lazy(() => import('./pages/admin/AdminGroupsPage'))

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
          { index: true, element: <DashboardPage /> },
          { path: 'setup', element: <StreetGroupSetupPage /> },
          { path: 'membership', element: <MembershipPage /> },
          { path: 'membership/setup', element: <MembershipSetupPage /> },
          { path: 'sharehire', element: <ShareHirePage /> },
          { path: 'mowers', element: <MowersPage /> },
          { path: 'manage', element: <GroupManagementPage /> },
          { path: 'user/:userId', element: <UserProfilePage /> },
          { path: 'user/:userId/edit', element: <UserProfileEditPage /> },
          { path: 'preferences', element: <UserPreferencesPage /> },
          { path: 'account', element: <AccountSettingsPage /> },
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
          { index: true, element: <MowerDashboardPage /> },
          { path: 'setup', element: <MowerSetupPage /> },
          { path: 'streets', element: <MowerStreetsPage /> },
          { path: 'history', element: <MowerHistoryPage /> },
          { path: 'user/:userId', element: <UserProfilePage /> },
          { path: 'user/:userId/edit', element: <UserProfileEditPage /> },
          { path: 'preferences', element: <UserPreferencesPage /> },
          { path: 'account', element: <AccountSettingsPage /> },
          { path: '*', element: <Placeholder title="Not found" /> },
        ],
      },
    ],
  },
  {
    path: '/mower/:mowerId',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <MowerPublicProfile /> }],
  },
  {
    path: '/admin',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <PrivateRoute allowedRoles={['admin']} />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'users/:userId', element: <AdminUserDetailPage /> },
          { path: 'groups', element: <AdminGroupsPage /> },
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
