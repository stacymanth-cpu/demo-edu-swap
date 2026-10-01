import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  if (!authReady) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}