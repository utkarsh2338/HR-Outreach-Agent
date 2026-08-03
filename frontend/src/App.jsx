import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const Pipeline      = lazy(() => import('./pages/Pipeline.jsx'));
const Contacts      = lazy(() => import('./pages/Contacts.jsx'));
const PendingDrafts = lazy(() => import('./pages/PendingDrafts.jsx'));
const NeedsAttention = lazy(() => import('./pages/NeedsAttention.jsx'));
const Profile       = lazy(() => import('./pages/Profile.jsx'));

const PageFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
  </div>
);

const App = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/"                  element={<Pipeline />} />
      <Route path="/contacts"          element={<Contacts />} />
      <Route path="/drafts"            element={<PendingDrafts />} />
      <Route path="/needs-attention"   element={<NeedsAttention />} />
      <Route path="/profile"           element={<Profile />} />
      <Route path="*"                  element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

export default App;
