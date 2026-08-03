import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

const Pipeline      = lazy(() => import('./pages/Pipeline.jsx'));
const Contacts      = lazy(() => import('./pages/Contacts.jsx'));
const PendingDrafts = lazy(() => import('./pages/PendingDrafts.jsx'));
const NeedsAttention = lazy(() => import('./pages/NeedsAttention.jsx'));
const Profile       = lazy(() => import('./pages/Profile.jsx'));
const Settings      = lazy(() => import('./pages/Settings.jsx'));
const Login         = lazy(() => import('./pages/Login.jsx'));

const PageFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Pipeline />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <Contacts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/drafts"
        element={
          <ProtectedRoute>
            <PendingDrafts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/needs-attention"
        element={
          <ProtectedRoute>
            <NeedsAttention />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
