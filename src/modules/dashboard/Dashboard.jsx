import { useEffect, useMemo, useState } from 'react';
import { Activity, Check, ChevronRight, ClipboardList, Clock3, FileImage, Layers, Search } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { caseService } from '../../services/caseService';
import './Dashboard.css';

const statusTabs = [
  ['All cases', null],
  ['Awaiting review', 'New'],
  ['In review', 'In Review'],
  ['Reviewed', 'Reviewed'],
];

function caseStatus(item) {
  return item.status || (item.reviewer ? 'In Review' : 'New');
}

function statusClass(status) {
  if (status === 'Reviewed') return 'dashboard-page__status--reviewed';
  if (status === 'In Review') return 'dashboard-page__status--reviewing';
  return 'dashboard-page__status--awaiting';
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function activityForCase(item) {
  const slideCount = item.slide_count || item.slides?.length || 0;
  if (caseStatus(item) === 'Reviewed') return { label: 'Case reviewed', detail: item.case_id, tone: 'reviewed', icon: Check };
  if (slideCount > 0) return { label: 'Slides available', detail: `${item.case_id} · ${slideCount} ${slideCount === 1 ? 'slide' : 'slides'}`, tone: 'reviewing', icon: FileImage };
  return { label: 'Case created', detail: item.case_id, tone: 'awaiting', icon: ClipboardList };
}

export default function Dashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const selectedCaseId = new URLSearchParams(location.search).get('case');
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    caseService.list(controller.signal)
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, []);

  const scopedCases = useMemo(() => cases.filter((item) => {
    const matchesStatus = !activeTab || caseStatus(item) === activeTab;
    const searchable = `${item.case_id || ''} ${item.description || ''} ${item.reviewer || ''}`.toLowerCase();
    return matchesStatus && searchable.includes(query.trim().toLowerCase());
  }), [activeTab, cases, query]);
  const count = (status) => cases.filter((item) => status ? caseStatus(item) === status : true).length;
  const slideCount = cases.reduce((total, item) => total + (item.slide_count || item.slides?.length || 0), 0);
  const cards = [
    ['Total cases', cases.length, ClipboardList, 'blue'],
    ['Awaiting review', count('New'), Clock3, 'amber'],
    ['In progress', count('In Review'), Activity, 'sky'],
    ['Completed', count('Reviewed'), Check, 'green'],
    ['Digital slides', slideCount, Layers, 'teal'],
  ];
  const recentActivity = useMemo(() => [...cases]
    .sort((first, second) => new Date(second.updated_at || second.created_at || 0) - new Date(first.updated_at || first.created_at || 0))
    .slice(0, 6), [cases]);
  const ownsOnlyCases = user?.role === 'Pathologist';

  if (selectedCaseId) return <Navigate to={`/cases${location.search}`} replace />;

  return <main className="dashboard-page" id="main-content">
    {error && <div className="dashboard-page__error" role="alert">Unable to load your case summary: {error}</div>}

    <section className="dashboard-page__metrics" aria-label="Case summary">
      {cards.map(([label, value, Icon, tone]) => <article key={label} className="dashboard-page__metric-card">
        <span className={`dashboard-page__metric-icon dashboard-page__metric-icon--${tone}`}><Icon size={21} /></span>
        <span><strong>{value}</strong><small>{label}</small>{label === 'Digital slides' ? <em>Across visible cases</em> : <em>{cases.length ? `${Math.round((value / cases.length) * 100)}% of cases` : 'No cases yet'}</em>}</span>
      </article>)}
    </section>

    <section className="dashboard-page__layout">
      <article className="dashboard-page__worklist dashboard-page__panel">
        <header className="dashboard-page__worklist-header">
          <div><h2>{ownsOnlyCases ? 'My cases' : 'Case worklist'}</h2><p>{ownsOnlyCases ? 'Cases assigned to you for review.' : 'Current cases available to your account.'}</p></div>
        </header>
        <div className="dashboard-page__tabs" role="tablist" aria-label="Case status">
          {statusTabs.map(([label, status]) => <button key={label} type="button" role="tab" aria-selected={activeTab === status} className={activeTab === status ? 'is-active' : ''} onClick={() => setActiveTab(status)}>{label} <span>({count(status)})</span></button>)}
        </div>
        <div className="dashboard-page__toolbar">
          <label className="dashboard-page__search"><Search size={17} /><span className="sr-only">Search cases</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cases, diagnosis, or assigned pathologist" /></label>
        </div>
        {!cases.length && !error ? <p className="dashboard-page__empty">Loading your current case activity…</p> : scopedCases.length ? <div className="dashboard-page__table-wrap"><table><thead><tr><th>Case ID</th><th>Specimen / description</th><th>Slides</th><th>Assigned pathologist</th><th>Status</th><th>Last updated</th></tr></thead><tbody>{scopedCases.slice(0, 10).map((item) => { const status = caseStatus(item); const slides = item.slide_count || item.slides?.length || 0; return <tr key={item.id}><td><Link to={`/cases?case=${item.id}`}>{item.case_id}</Link></td><td><strong>{item.description || 'Description not recorded'}</strong></td><td>{slides}</td><td>{item.reviewer || 'Unassigned'}</td><td><span className={`dashboard-page__status ${statusClass(status)}`}>{status}</span></td><td>{formatDate(item.updated_at || item.created_at)}</td></tr>; })}</tbody></table></div> : <p className="dashboard-page__empty">No cases match the selected filter.</p>}
      </article>

      <aside className="dashboard-page__activity-panel dashboard-page__panel" aria-label="Recent activity">
        <header><h2>Recent activity</h2></header>
        {recentActivity.length ? <ul className="dashboard-page__activity-list">{recentActivity.map((item) => { const event = activityForCase(item); const Icon = event.icon; return <li key={item.id}><span className={`dashboard-page__activity-icon dashboard-page__activity-icon--${event.tone}`}><Icon size={16} /></span><span><strong>{event.label}</strong><small>{event.detail}</small></span><time>{formatDate(item.updated_at || item.created_at)}</time></li>; })}</ul> : <p className="dashboard-page__empty">No recent case activity.</p>}
      </aside>
    </section>
  </main>;
}
