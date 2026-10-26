import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../modules/auth/AuthProvider';
import ClinicalSidebar from './ClinicalSidebar';
import { platformService } from '../../services/platformService';
const contrastText = (hex) => { const value = String(hex || '').replace('#', ''); if (value.length !== 6) return '#fff'; const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)); return ((r * 299 + g * 587 + b * 114) / 1000) > 150 ? '#102030' : '#fff'; };
const details = {
  '/': ['Dashboard', 'Monitor current case review and digital slide activity.'],
  '/case-library': ['Case Library', 'Browse cases and inspect their associated slides.'],
  '/slides': ['Slide Library', 'Browse digital slides and open them in the clinical viewer.'],
  '/ai-features': ['AI Extensions', 'Review governed clinical decision-support models.'],
  '/patients': ['Patient Directory', 'Search and manage patient-linked pathology history.'],
  '/platform': ['Operations Control Center', 'Monitor laboratory queues and image ingestion.'],
  '/admin': ['User management', 'Manage accounts, roles, and access.'],
  '/admin/settings': ['System settings', 'Manage the platform branding and appearance.'],
  '/admin/logs': ['Activity logs', 'Review administrative and clinical events.'],
  '/admin/ai-licensing': ['AI licensing', 'Manage AI access and subscriptions.'],
  '/admin/ai-features': ['Manage AI Features', 'Configure available AI feature cards.'],
};

export default function ClinicalShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [title, subtitle] = details[pathname] || ['Pathology workspace', 'Review cases and compare slides.'];
  const displayName = user?.display_name || user?.username || 'User';
  const [branding, setBranding] = useState({ title: 'Digital Pathology Platform', subtitle: 'Digital Pathology Platform', logo: null, logoSize: '32', titleSize: '14', subtitleSize: '10', theme: 'dark', primaryColor: '#4a90c2', secondaryColor: '#087f8c' });
  useEffect(() => { const controller = new AbortController(); platformService.branding(controller.signal).then((data) => { const text = contrastText(data.primaryColor); setBranding(data); document.documentElement.dataset.theme = data.theme || 'dark'; document.documentElement.style.setProperty('--brand-logo-size', `${data.logoSize || 32}px`); document.documentElement.style.setProperty('--brand-title-size', `${data.titleSize || 14}px`); document.documentElement.style.setProperty('--brand-subtitle-size', `${data.subtitleSize || 10}px`); document.documentElement.style.setProperty('--color-primary', data.primaryColor || '#4a90c2'); document.documentElement.style.setProperty('--primary', data.primaryColor || '#4a90c2'); document.documentElement.style.setProperty('--sidebar-background', data.primaryColor || '#4a90c2'); document.documentElement.style.setProperty('--sidebar-text', text); document.documentElement.style.setProperty('--sidebar-muted', text === '#fff' ? '#d8e5f0' : '#405466'); document.documentElement.style.setProperty('--sidebar-active-text', text); document.documentElement.style.setProperty('--sidebar-active-background', text === '#fff' ? 'rgba(255,255,255,.18)' : 'rgba(15,35,55,.12)'); document.documentElement.style.setProperty('--color-accent', data.secondaryColor || '#087f8c'); }).catch(() => {}); return () => controller.abort(); }, []);

  return <div className="clinical-shell"><ClinicalSidebar branding={branding} /><div className="clinical-shell__content"><header className="clinical-topbar"><span><strong>{title}</strong><small>{subtitle}</small></span><div className="clinical-topbar__account"><span className="clinical-topbar__connection"><i />Connected</span><span className="clinical-topbar__user"><b>{displayName.slice(0, 1).toUpperCase()}</b><span><strong>{displayName}</strong><small>{user?.role}</small></span></span><button className="clinical-topbar__logout" onClick={logout} aria-label="Log out"><LogOut size={17} /></button></div></header>{children}</div></div>;
}
