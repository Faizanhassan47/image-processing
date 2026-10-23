import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Eye, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { caseService } from '../../services/caseService';
import { platformService } from '../../services/platformService';
import Modal from '../../components/Modal/Modal';
import { useAuth } from '../auth/AuthProvider';
import { isAdministratorRole } from '../../config/roles';
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
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [casePendingRemoval, setCasePendingRemoval] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    caseService.list(controller.signal)
      .then((items) => setCases(Array.isArray(items) ? items : []))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message || 'Unable to load cases.'); });
    return () => controller.abort();
  }, []);

  const filteredCases = useMemo(() => cases.filter((caseItem) => {
    const value = `${caseItem.case_id || ''} ${caseItem.description || ''} ${caseItem.patient_id || ''} ${caseItem.reviewer || ''} ${caseItem.status || ''}`.toLowerCase();
    return value.includes(query.trim().toLowerCase()) && (status === 'All' || caseStatus(caseItem) === status);
  }), [cases, query, status]);
  const active = selected || filteredCases[0] || null;
  const canDeleteCases = isAdministratorRole(user?.role);

  async function removeCase() {
    if (!casePendingRemoval || removing) return;
    setRemoving(true);
    setError('');
    try {
      await platformService.deleteCase(casePendingRemoval.id);
      setCases((current) => current.filter((caseItem) => caseItem.id !== casePendingRemoval.id));
      setSelected(null);
      setCasePendingRemoval(null);
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
    </label><label className="case-library__filter"><SlidersHorizontal size={16} /><span className="sr-only">Case status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="All">All statuses</option><option value="New">Awaiting review</option><option value="In Review">In review</option><option value="Reviewed">Reviewed</option></select></label></section>
    {error && <p className="case-library__error" role="alert">{error}</p>}

    <div className="case-library__layout">
      <section>
        <p className="case-library__count">{filteredCases.length} case{filteredCases.length === 1 ? '' : 's'}</p>
        <div className="case-library__list">
          {filteredCases.map((caseItem) => {
            const status = caseStatus(caseItem);
            const slides = caseItem.slide_count ?? caseItem.slides?.length ?? 0;
            return <button type="button" key={caseItem.id} onClick={() => setSelected(caseItem)} className={`case-library__card${active?.id === caseItem.id ? ' case-library__card--selected' : ''}`}>
              <span className="case-library__card-icon"><ClipboardList size={20} /></span>
              <span className="case-library__card-content"><strong>{caseItem.case_id || `Case ${caseItem.id}`}</strong><small>{caseItem.description || 'Clinical description not recorded'}</small><em>{slides} {slides === 1 ? 'slide' : 'slides'} · {caseItem.reviewer || 'Unassigned'}</em></span>
              <span className={`case-library__status case-library__status--${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
            </button>;
          })}
          {!filteredCases.length && <div className="case-library__empty"><ClipboardList size={26} /><strong>No cases found</strong><span>Adjust the search to find a case.</span></div>}
        </div>
      </section>

      <aside className="case-library__details">
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
      </aside>
    </div>
    <Modal open={Boolean(casePendingRemoval)} title="Remove case" onClose={() => !removing && setCasePendingRemoval(null)} footer={<><button type="button" className="modal-button modal-button--secondary" disabled={removing} onClick={() => setCasePendingRemoval(null)}>Cancel</button><button type="button" className="modal-button btn-delete" disabled={removing} onClick={removeCase}>{removing ? 'Removing…' : 'Remove case'}</button></>}><p className="confirmation-copy">Remove case <strong>{casePendingRemoval?.case_id}</strong>? All associated slides, annotations, drafts, and non-finalized reports will be removed. Source files are moved to protected deleted storage.</p></Modal>
  </main>;
}
