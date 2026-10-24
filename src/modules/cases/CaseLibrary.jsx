import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Eye, LayoutList, MoreHorizontal, Plus, Search, SlidersHorizontal, Table2, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { caseService } from '../../services/caseService';
import { platformService } from '../../services/platformService';
import Modal from '../../components/Modal/Modal';
import { useAuth } from '../auth/AuthProvider';
import { isAdministratorRole } from '../../config/roles';
import { notifyClinicalDataChanged } from '../../services/clinicalDataEvents';
import Pagination from '../../components/Pagination/Pagination';
import './CaseLibrary.css';

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function caseStatus(caseItem) {
  return caseItem.status || (caseItem.reviewer ? 'In Review' : 'New');
}

export default function CaseLibrary() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [sort, setSort] = useState('created_at:desc');
  const [view, setView] = useState('table');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [casePendingRemoval, setCasePendingRemoval] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [actionMenuCaseId, setActionMenuCaseId] = useState(null);
  const actionMenuRef = useRef(null);

  const pageSize = 25;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const [sort_by, sort_direction] = sort.split(':');
    caseService.list({ search: debouncedQuery, status: status === 'All' ? null : status, assigned_to_me: assignedToMe || null, sort_by, sort_direction, limit: pageSize, offset: page * pageSize }, controller.signal)
      .then((data) => {
        setCases(Array.isArray(data) ? data : data.items || []);
        setTotal(Array.isArray(data) ? data.length : data.total || 0);
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message || 'Unable to load cases.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [assignedToMe, debouncedQuery, page, sort, status]);

  useEffect(() => { setPage(0); setSelected(null); }, [assignedToMe, debouncedQuery, sort, status]);
  useEffect(() => {
    const closeMenu = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) setActionMenuCaseId(null);
    };
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, []);
  const active = selected || cases[0] || null;
  const canDeleteCases = isAdministratorRole(user?.role);
  const canCreateCases = isAdministratorRole(user?.role) || user?.role === 'Laboratory Manager / Supervisor';
  const applySavedView = (viewName) => {
    if (viewName === 'mine') { setAssignedToMe(true); setStatus('All'); }
    if (viewName === 'awaiting') { setAssignedToMe(false); setStatus('New'); }
    if (viewName === 'reviewing') { setAssignedToMe(false); setStatus('In Review'); }
    if (viewName === 'all') { setAssignedToMe(false); setStatus('All'); }
  };

  async function removeCase() {
    if (!casePendingRemoval || removing) return;
    setRemoving(true);
    setError('');
    try {
      await platformService.deleteCase(casePendingRemoval.id);
      setCases((current) => current.filter((caseItem) => caseItem.id !== casePendingRemoval.id));
      setTotal((current) => Math.max(0, current - 1));
      setSelected(null);
      setCasePendingRemoval(null);
      notifyClinicalDataChanged({ type: 'case-deleted', caseId: casePendingRemoval.id });
    } catch (err) {
      setError(err.message || 'Unable to remove case.');
    } finally {
      setRemoving(false);
    }
  }

  return <main className="case-library" id="main-content">

    <section className="case-library__filters" aria-label="Case library filters"><label className="case-library__search">
      <Search size={17} />
      <span className="sr-only">Search cases</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case ID, patient ID, diagnosis, or assigned pathologist" />
    </label><label className="case-library__filter"><SlidersHorizontal size={16} /><span className="sr-only">Case status</span><select value={status} onChange={(event) => { setAssignedToMe(false); setStatus(event.target.value); }}><option value="All">All statuses</option><option value="New">Awaiting review</option><option value="In Review">In review</option><option value="Reviewed">Reviewed</option></select></label><label className="case-library__filter"><span className="sr-only">Sort cases</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="created_at:desc">Newest first</option><option value="case_id:asc">Case ID A–Z</option><option value="status:asc">Status</option><option value="reviewer:asc">Assigned pathologist</option></select></label><div className="case-library__view-toggle" role="group" aria-label="Case display"><button type="button" className={view === 'cards' ? 'is-active' : ''} onClick={() => setView('cards')} aria-label="Card view"><LayoutList size={16} /></button><button type="button" className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')} aria-label="Table view"><Table2 size={16} /></button></div></section>
    {error && <p className="case-library__error" role="alert">{error}</p>}

    <div className={`case-library__layout${view === 'table' ? ' case-library__layout--worklist' : ''}`}>
      <section>
        <p className="case-library__count">{total} case{total === 1 ? '' : 's'}</p>
        {view === 'table' ? <div className="case-library__data-table-wrap"><table className="case-library__data-table"><thead><tr><th>Case / patient</th><th>Specimen</th><th>Slides</th><th>Assigned to</th><th>Status</th><th>Priority</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index}><td colSpan="8"><div className="case-library__table-skeleton" aria-hidden="true" /></td></tr>) : cases.map((caseItem) => {
            const itemStatus = caseStatus(caseItem);
            const slides = caseItem.slide_count ?? caseItem.slides?.length ?? 0;
            return <tr key={caseItem.id}>
              <td><Link className="case-library__case-cell" to={`/cases?case=${caseItem.id}`}><span className="case-library__card-icon"><ClipboardList size={18} /></span><span><strong>{caseItem.case_id || `Case ${caseItem.id}`}</strong><small>{caseItem.patient_name || caseItem.patient_id || 'Patient not recorded'}</small></span></Link></td>
              <td><strong>{caseItem.specimen_type || caseItem.description || 'Not recorded'}</strong><small>{caseItem.diagnosis || caseItem.description || 'Clinical details not recorded'}</small></td>
              <td>{slides}</td><td>{caseItem.reviewer || 'Unassigned'}</td><td><span className={`case-library__status case-library__status--${itemStatus.toLowerCase().replace(/\s+/g, '-')}`}>{itemStatus}</span></td><td><span className="case-library__priority">{caseItem.priority || 'Not set'}</span></td><td>{formatDate(caseItem.created_at)}</td>
              <td><div className="case-library__row-actions" ref={actionMenuCaseId === caseItem.id ? actionMenuRef : null}><button type="button" className="case-library__row-action" onClick={() => setActionMenuCaseId((current) => current === caseItem.id ? null : caseItem.id)} aria-label={`Actions for ${caseItem.case_id || `case ${caseItem.id}`}`} aria-expanded={actionMenuCaseId === caseItem.id}><MoreHorizontal size={18} /></button>{actionMenuCaseId === caseItem.id && <div className="case-library__action-menu" role="menu"><Link to={`/cases?case=${caseItem.id}`} role="menuitem" onClick={() => setActionMenuCaseId(null)}><Eye size={15} />Open case workspace</Link>{canDeleteCases && <button type="button" role="menuitem" onClick={() => { setActionMenuCaseId(null); setCasePendingRemoval(caseItem); }}><Trash2 size={15} />Remove case</button>}</div>}</div></td>
            </tr>;
          })}
          {!loading && !cases.length && <tr><td colSpan="8"><div className="case-library__empty"><ClipboardList size={26} /><strong>No cases found</strong><span>Adjust the search or status filter to find a case.</span></div></td></tr>}
        </tbody></table></div> : <div className="case-library__list">
          {loading ? Array.from({ length: 5 }, (_, index) => <div key={index} className="case-library__skeleton" aria-hidden="true" />) : cases.map((caseItem) => {
            const status = caseStatus(caseItem);
            const slides = caseItem.slide_count ?? caseItem.slides?.length ?? 0;
            return <button type="button" key={caseItem.id} onClick={() => setSelected(caseItem)} className={`case-library__card${active?.id === caseItem.id ? ' case-library__card--selected' : ''}`}>
              <span className="case-library__card-icon"><ClipboardList size={20} /></span>
              <span className="case-library__card-content"><strong>{caseItem.case_id || `Case ${caseItem.id}`}</strong><small>{caseItem.description || 'Clinical description not recorded'}</small><em>{slides} {slides === 1 ? 'slide' : 'slides'} · {caseItem.reviewer || 'Unassigned'}</em></span>
              <span className={`case-library__status case-library__status--${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
            </button>;
          })}
          {!loading && !cases.length && <div className="case-library__empty"><ClipboardList size={26} /><strong>No cases found</strong><span>Adjust the search or status filter to find a case.</span></div>}
        </div>}
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} disabled={loading} label="Case library pages" />
      </section>

      {view === 'cards' && <aside className="case-library__details">
        {active ? <>
          <button type="button" className="case-library__close" onClick={() => setSelected(null)} aria-label="Clear selected case"><X size={16} /></button>
          <div className="case-library__details-title"><ClipboardList size={26} /><div><h2>{active.case_id || `Case ${active.id}`}</h2><span className={`case-library__status case-library__status--${caseStatus(active).toLowerCase().replace(/\s+/g, '-')}`}>{caseStatus(active)}</span></div></div>
          <Link to={`/cases?case=${active.id}`} className="btn-primary route-link"><Eye size={16} />Open case workspace</Link>
          {canDeleteCases && <button type="button" className="case-library__delete" onClick={() => setCasePendingRemoval(active)} disabled={removing}><Trash2 size={15} />Remove case</button>}
          <section className="case-library__metadata" aria-labelledby="case-library-metadata-title">
            <h3 id="case-library-metadata-title">Case details</h3>
            <dl>
              <div><dt>Case ID</dt><dd>{active.case_id || active.id}</dd></div>
              <div><dt>Patient ID</dt><dd>{active.patient_id || 'Not recorded'}</dd></div>
              <div><dt>Description</dt><dd>{active.description || 'Not recorded'}</dd></div>
              <div><dt>Assigned pathologist</dt><dd>{active.reviewer || 'Unassigned'}</dd></div>
              <div><dt>Slides</dt><dd>{active.slide_count ?? active.slides?.length ?? 0}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(active.created_at)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDate(active.updated_at || active.created_at)}</dd></div>
            </dl>
          </section>
          <section className="case-library__slides" aria-labelledby="case-library-slides-title">
            <h3 id="case-library-slides-title">Associated slides</h3>
            {(active.slides || []).length ? <ul>{active.slides.map((slide) => <li key={slide.id}><Link to={`/cases?case=${active.id}&slide=${slide.id}`}>{slide.label || `Slide ${slide.id}`}</Link><span>{slide.stain || slide.file_type?.toUpperCase() || 'Slide'}</span></li>)}</ul> : <p>No slides have been added to this case.</p>}
          </section>
        </> : <div className="case-library__details-empty"><ClipboardList size={28} /><p>Select a case to view its details.</p></div>}
      </aside>}
    </div>
    <Modal open={Boolean(casePendingRemoval)} title="Remove case" onClose={() => !removing && setCasePendingRemoval(null)} footer={<><button type="button" className="modal-button modal-button--secondary" disabled={removing} onClick={() => setCasePendingRemoval(null)}>Cancel</button><button type="button" className="modal-button btn-delete" disabled={removing} onClick={removeCase}>{removing ? 'Removing…' : 'Remove case'}</button></>}><p className="confirmation-copy">Remove case <strong>{casePendingRemoval?.case_id}</strong>? All associated slides, annotations, drafts, and non-finalized reports will be removed. Source files are moved to protected deleted storage.</p></Modal>
  </main>;
}
