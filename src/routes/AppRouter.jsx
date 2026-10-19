import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import ErrorBoundary from '../components/ErrorBoundary/ErrorBoundary';
import Login from '../modules/auth/Login';
import { API_BASE_URL } from '../config';
import { isAdministratorRole } from '../config/roles';

const Workspace = lazy(() => import('../modules/workspace/PathologyWorkspace'));
const AdminPanel = lazy(() => import('../components/AdminPanel/AdminPanel'));
const AdministrationLogs = lazy(() => import('../components/AdministrationLogs/AdministrationLogs'));
const PlatformOperations = lazy(() => import('../modules/platform/PlatformOperations'));
const PatientDirectory = lazy(() => import('../modules/patients/PatientDirectory'));
const PatientProfile = lazy(() => import('../modules/patients/PatientProfile'));

function LoadingScreen() { return <main className="route-loading" aria-live="polite"><span className="loading-spinner" /> Loading workspace…</main>; }
function ProtectedRoute({ adminOnly = false, operationsAccess = false, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (adminOnly && !isAdministratorRole(user.role)) return <Navigate to="/" replace />;
  if (operationsAccess && !isAdministratorRole(user.role) && user.role !== 'Laboratory Manager') return <Navigate to="/" replace />;
  return children;
}
function AdminShell({ title, children }) { return <div className="admin-page-layout">
  <header className="header admin-page-header"><div className="header-brand"><div><p className="page-eyebrow">Administration</p><h1>{title}</h1></div></div><nav className="admin-route-nav" aria-label="Administration"><Link to="/admin" className="btn-control-secondary route-link">Users</Link><Link to="/admin/logs" className="btn-control-secondary route-link">Logs</Link><Link to="/platform" className="btn-control-secondary route-link">Platform</Link><Link to="/" className="btn-control-secondary route-link">Workspace</Link></nav></header>
  <main id="main-content" className="admin-page-content"><div className="admin-page-inner">{children}</div></main>
</div>; }
function AdminPage() { return <AdminShell title="User management"><AdminPanel API={API_BASE_URL} /></AdminShell>; }
function AdminLogsPage() { return <AdminShell title="Activity logs"><AdministrationLogs /></AdminShell>; }
function NotFound() { return <main id="main-content" className="not-found"><h1>Page not found</h1><p>The requested page does not exist.</p><Link to="/" className="btn-primary route-link">Return to workspace</Link></main>; }

export default function AppRouter() { return <BrowserRouter><Suspense fallback={<LoadingScreen />}><Routes>
  <Route path="/" element={<ProtectedRoute><ErrorBoundary title="The workspace could not be displayed"><Workspace /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/admin" element={<ProtectedRoute adminOnly><ErrorBoundary title="The admin panel could not be displayed"><AdminPage /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/admin/logs" element={<ProtectedRoute adminOnly><ErrorBoundary title="Activity logs could not be displayed"><AdminLogsPage /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/platform" element={<ProtectedRoute operationsAccess><ErrorBoundary title="Platform operations could not be displayed"><PlatformOperations /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/patients" element={<ProtectedRoute><ErrorBoundary title="The patient directory could not be displayed"><PatientDirectory /></ErrorBoundary></ProtectedRoute>} />
  <Route path="/patients/:patientId" element={<ProtectedRoute><ErrorBoundary title="The patient profile could not be displayed"><PatientProfile /></ErrorBoundary></ProtectedRoute>} />
  <Route path="*" element={<NotFound />} />
</Routes></Suspense></BrowserRouter>; }
