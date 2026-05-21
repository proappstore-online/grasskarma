import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// `/` lands here once the user is signed in + has a role. Bounces them to
// the right dashboard for their role.
export function RoleRedirect() {
  const { user } = useAuth()
  if (!user?.role) return <Navigate to="/" replace />
  if (user.role === 'mower') return <Navigate to="/mower" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/app" replace />
}
