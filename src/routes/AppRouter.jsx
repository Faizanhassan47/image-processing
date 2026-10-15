import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import ErrorBoundary from '../components/ErrorBoundary/ErrorBoundary';
import Login from '../modules/auth/Login';
import { API_BASE_URL } from '../config';

const Workspace = lazy(() => import('../modules/workspace/PathologyWorkspace'));
const AdminPanel = lazy(() => import('../components/AdminPanel/AdminPanel'));
const PlatformOperations = lazy(() => import('../modules/platform/PlatformOperations'));

function LoadingScreen() { return <main className="route-loading" aria-live="polite"><span className="loading-spinner" /> Loading workspace…</main>; }
function ProtectedRoute({ adminOnly = false, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/" replace />;
  return children;
}
function AdminPage() { return <div className="admin-page-layout">
  <header className="header admin-page-header"><div className="header-brand"><div><p className="page-eyebrow">Administration</p><h1>User management</h1></div></div><Link to="/platform" className="btn-control-secondary route-link">Platform operations</Link><Link to="/" className="btn-control-secondary route-link">Back to workspace</Link></header>
  <main id="main-content" className="admin-page-content"><div className="admin-page-inner"><AdminPanel API={API_BASE_URL} /></div></main>
</div>; }
function NotFound() { return <main id="main-content" className="not-found"><h1>Page not found</h1><p>The requested page does not exist.</p><Link to="/" className="btn-primary route-link">Return to workspace</Link></main>; }

export default function AppRouter() { return <BrowserRouter><Suspense fallback={<LoadingScreen />}><Routes>
  <Route path="/" element={<ProtectedRoute><ErrorBoundary title="The workspace could not be displayed"><Workspace /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/admin" element={<ProtectedRoute adminOnly><ErrorBoundary title="The admin panel could not be displayed"><AdminPage /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/platform" element={<ProtectedRoute adminOnly><ErrorBoundary title="Platform operations could not be displayed"><PlatformOperations /></ErrorBoundary></ProtectedRoute>} />
  <Route path="*" element={<NotFound />} />
</Routes></Suspense></BrowserRouter>; }
