import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../models'

interface Props {
  allowedRoles: Role[]
}

export function PrivateRoute({ allowedRoles }: Props) {
  const { user } = useAuth()
  if (!user?.role) return <Navigate to="/" replace />
  if (!allowedRoles.includes(user.role)) {
    const home = user.role === 'mower' ? '/mower' : user.role === 'admin' ? '/admin' : '/app'
    return <Navigate to={home} replace />
  }
  return <Outlet />
}
