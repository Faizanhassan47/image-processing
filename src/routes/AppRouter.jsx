import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthProvider';
import ErrorBoundary from '../components/ErrorBoundary/ErrorBoundary';
import ClinicalShell from '../components/layout/ClinicalShell';
import Login from '../modules/auth/Login';
import { API_BASE_URL } from '../config';
import { isAdministratorRole, isProtectedSuperAdmin, SUPER_ADMIN_ROLE } from '../config/roles';
import { Activity, BrainCircuit, ClipboardList, FileText, Microscope, Settings, ShieldCheck, UsersRound } from 'lucide-react';

const Workspace = lazy(() => import('../modules/workspace/PathologyWorkspace'));
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const SlideLibrary = lazy(() => import('../modules/slides/SlideLibrary'));
const AdminPanel = lazy(() => import('../components/AdminPanel/AdminPanel'));
const AdministrationLogs = lazy(() => import('../components/AdministrationLogs/AdministrationLogs'));
const PlatformOperations = lazy(() => import('../modules/platform/PlatformOperations'));
const PatientDirectory = lazy(() => import('../modules/patients/PatientDirectory'));
const PatientProfile = lazy(() => import('../modules/patients/PatientProfile'));
const AIFeatures = lazy(() => import('../modules/ai/AIFeatures'));
const AILicensing = lazy(() => import('../modules/ai/AILicensing'));
const ManageAIFeatures = lazy(() => import('../modules/ai/ManageAIFeatures'));

function LoadingScreen() { return <main className="route-loading" aria-live="polite"><span className="loading-spinner" /> Loading workspace…</main>; }
function ProtectedRoute({ adminOnly = false, superAdminOnly = false, operationsAccess = false, pathologistExcluded = false, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (adminOnly && !isAdministratorRole(user.role)) return <Navigate to="/" replace />;
  if (superAdminOnly && user.role !== SUPER_ADMIN_ROLE && !isProtectedSuperAdmin(user.username)) return <Navigate to="/" replace />;
  if (operationsAccess && !isAdministratorRole(user.role) && user.role !== 'Laboratory Manager') return <Navigate to="/" replace />;
  if (pathologistExcluded && user.role === 'Pathologist') return <Navigate to="/" replace />;
  return children;
}
function AdminShell({ title, children }) {
  const { user } = useAuth(); const canManageCards = user?.role === SUPER_ADMIN_ROLE || isProtectedSuperAdmin(user?.username); return <div className="admin-page-layout">
    <div className="clinical-shell">
      <aside className="clinical-sidebar" aria-label="Primary navigation"><Link to="/" className="clinical-brand"><Microscope size={23} /><span><small>Digital Pathology Platform</small></span></Link><nav className="clinical-nav"><span className="clinical-nav__label">WORKSPACE</span><Link to="/dashboard" className="clinical-nav__link"><ClipboardList size={16} />Dashboard</Link><Link to="/" className="clinical-nav__link"><ClipboardList size={16} />Cases workspace</Link><Link to="/slides" className="clinical-nav__link"><FileText size={16} />Slide library</Link>{user?.role !== 'Pathologist' && <Link to="/patients" className="clinical-nav__link"><UsersRound size={16} />Patient directory</Link>}<Link to="/ai-features" className="clinical-nav__link"><BrainCircuit size={16} />AI analysis</Link><Link to="/platform" className="clinical-nav__link"><Activity size={16} />Operations</Link><span className="clinical-nav__spacer" /><span className="clinical-nav__label">MANAGEMENT</span><Link to="/admin" className="clinical-nav__link"><ShieldCheck size={16} />Users & roles</Link>{canManageCards && <><Link to="/admin/ai-features" className="clinical-nav__link"><Settings size={16} />AI model management</Link><Link to="/admin/ai-licensing" className="clinical-nav__link"><Settings size={16} />AI licensing</Link><Link to="/admin/logs" className="clinical-nav__link"><Activity size={16} />Activity logs</Link></>}</nav></aside>
      <div className="clinical-shell__content"><header className="header admin-page-header"><div className="header-brand"><div><p className="page-eyebrow">Administration</p><h1>{title}</h1></div></div></header><main id="main-content" className="admin-page-content"><div className="admin-page-inner">{children}</div></main></div>
    </div>
  </div>;
}
function AdminPage() { return <AdminShell title="User management"><AdminPanel API={API_BASE_URL} /></AdminShell>; }
function AdminLogsPage() { return <AdminShell title="Activity logs"><AdministrationLogs /></AdminShell>; }
function AILicensingPage() { return <AdminShell title="AI licensing"><AILicensing /></AdminShell>; }
function ManageAIFeaturesPage() { return <AdminShell title="Manage AI Features"><ManageAIFeatures /></AdminShell>; }
function NotFound() { return <main id="main-content" className="not-found"><h1>Page not found</h1><p>The requested page does not exist.</p><Link to="/" className="btn-primary route-link">Return to workspace</Link></main>; }

export default function AppRouter() {
  return <BrowserRouter><Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/" element={<ProtectedRoute><ClinicalShell><ErrorBoundary title="The dashboard could not be displayed"><Dashboard /></ErrorBoundary></ClinicalShell></ProtectedRoute>} />
    <Route path="/dashboard" element={<Navigate to="/" replace />} />
    <Route path="/slides" element={<ProtectedRoute><ClinicalShell><ErrorBoundary title="The slide library could not be displayed"><SlideLibrary /></ErrorBoundary></ClinicalShell></ProtectedRoute>} />
    <Route path="/cases" element={<ProtectedRoute><ErrorBoundary title="The workspace could not be displayed"><Workspace /></ErrorBoundary></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute adminOnly><ErrorBoundary title="The admin panel could not be displayed"><AdminPage /></ErrorBoundary></ProtectedRoute>} />
    <Route path="/admin/logs" element={<ProtectedRoute adminOnly><ErrorBoundary title="Activity logs could not be displayed"><AdminLogsPage /></ErrorBoundary></ProtectedRoute>} />
    <Route path="/admin/ai-licensing" element={<ProtectedRoute adminOnly><ErrorBoundary title="AI licensing could not be displayed"><AILicensingPage /></ErrorBoundary></ProtectedRoute>} />
    <Route path="/admin/ai-features" element={<ProtectedRoute superAdminOnly><ErrorBoundary title="AI feature management could not be displayed"><ManageAIFeaturesPage /></ErrorBoundary></ProtectedRoute>} />
    <Route path="/platform" element={<ProtectedRoute operationsAccess><ClinicalShell><ErrorBoundary title="Platform operations could not be displayed"><PlatformOperations /></ErrorBoundary></ClinicalShell></ProtectedRoute>} />
    <Route path="/patients" element={<ProtectedRoute pathologistExcluded><ClinicalShell><ErrorBoundary title="The patient directory could not be displayed"><PatientDirectory /></ErrorBoundary></ClinicalShell></ProtectedRoute>} />
    <Route path="/patients/:patientId" element={<ProtectedRoute pathologistExcluded><ClinicalShell><ErrorBoundary title="The patient profile could not be displayed"><PatientProfile /></ErrorBoundary></ClinicalShell></ProtectedRoute>} />
    <Route path="/ai-features" element={<ProtectedRoute><ClinicalShell><ErrorBoundary title="AI features could not be displayed"><AIFeatures /></ErrorBoundary></ClinicalShell></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></BrowserRouter>;
}
