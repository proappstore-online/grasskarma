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
import UserProfilePage from './pages/UserProfile/UserProfilePage'
import UserProfileEditPage from './pages/UserProfile/UserProfileEditPage'
import UserPreferencesPage from './pages/UserProfile/UserPreferencesPage'
import AccountSettingsPage from './pages/UserProfile/AccountSettingsPage'

// Mower pages
import MowerDashboardPage from './pages/mower/MowerDashboardPage'
import MowerSetupPage from './pages/mower/MowerSetupPage'
import MowerStreetsPage from './pages/mower/MowerStreetsPage'
import MowerHistoryPage from './pages/mower/MowerHistoryPage'
import MowerPublicProfile from './pages/mower/MowerPublicProfile'

// Admin pages (flattened from admin/src)
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage'
import AdminGroupsPage from './pages/admin/AdminGroupsPage'

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
