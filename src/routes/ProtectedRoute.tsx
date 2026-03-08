import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: UserRole;
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (user.role !== allowedRole) {
    const home = user.role === 'administrador' ? '/admin/dashboard' : '/colaborador/home';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
