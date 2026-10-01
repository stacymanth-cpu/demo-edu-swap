import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();

  // Show loading spinner while Firebase auth initializes
  if (!authReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary, #0a0a0f)',
      }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
