import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { Sidebar } from './components/Sidebar';
import { NetworkStatus } from './components/NetworkStatus';
import { IncomingCallAlert } from './components/IncomingCallAlert';
import './index.css';

const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then(module => ({ default: module.SignUpPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then(module => ({ default: module.ExplorePage })));
const MatchesPage = lazy(() => import('./pages/MatchesPage').then(module => ({ default: module.MatchesPage })));
const SessionsPage = lazy(() => import('./pages/SessionsPage').then(module => ({ default: module.SessionsPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })));
const VideoCallPage = lazy(() => import('./pages/VideoCallPage').then(module => ({ default: module.VideoCallPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const TutorProfilePage = lazy(() => import('./pages/TutorProfilePage').then(module => ({ default: module.TutorProfilePage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then(module => ({ default: module.AdminLoginPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const GroupCallPage = lazy(() => import('./pages/GroupCallPage').then(module => ({ default: module.GroupCallPage })));

function AppLayout() {
  const { user, authReady } = useAuth();
  const location = useLocation();
  const isAuthPage = ['/login', '/signup'].includes(location.pathname);
  const isChatPage = location.pathname === '/chat';
  const isLanding = location.pathname === '/' && !user;

  // Don't show sidebar on landing or auth pages
  const hideSidebar = isAuthPage || isLanding || !authReady;

  return (
    <div className={`app-layout ${hideSidebar ? '' : 'with-sidebar'} ${isChatPage && !isLanding ? 'chat-layout' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <NetworkStatus />
      {!hideSidebar && <Sidebar />}
      {user && <IncomingCallAlert />}
      <main id="main-content" tabIndex={-1} className={`main-content ${hideSidebar ? 'no-sidebar' : ''}`}>
        <Suspense fallback={<div className="route-loading" role="status"><span className="skeleton skeleton-title" /><span className="skeleton skeleton-card" /><span className="sr-only">Loading page</span></div>}>
        <Routes>
          <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
          <Route path="/signup" element={<AuthRedirect><SignUpPage /></AuthRedirect>} />
          <Route path="/admin/login" element={<AuthRedirect><AdminLoginPage /></AuthRedirect>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/" element={<RootRoute />} />
          <Route path="/explore" element={<ProtectedRoute><ExplorePage /></ProtectedRoute>} />
          <Route path="/tutor/:uid" element={<ProtectedRoute><TutorProfilePage /></ProtectedRoute>} />
          <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
          <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/video-call" element={<ProtectedRoute><VideoCallPage /></ProtectedRoute>} />
          <Route path="/group-call" element={<ProtectedRoute><GroupCallPage /></ProtectedRoute>} />
          <Route path="/calls" element={<Navigate to="/video-call" replace />} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}

/** Show landing page for visitors, dashboard for logged-in users */
function RootRoute() {
  const { user, authReady } = useAuth();
  if (!authReady) return null;
  if (user) return <HomePage />;
  return <LandingPage />;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
