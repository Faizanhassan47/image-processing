import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, Edit3, FileImage, Layers, ClipboardCheck, History, Microscope, Columns, X,
  Plus, Search, Upload, UserRound, LogOut, ChevronDown
} from 'lucide-react';
import Empty from '../../components/EmptyState/EmptyState';
import Field from '../../components/Field/Field';
import ReportEditor from '../../components/ReportEditor/ReportEditor';
import SlideViewer from '../../components/SlideViewer/SlideViewer';
import './PathologyWorkspace.css';
import Login from '../auth/Login';
import { useAuth } from '../auth/AuthProvider';
import { API_BASE_URL as API } from '../../config';
import { apiFetch } from '../../api';
import { Link } from 'react-router-dom';
import useCaseWorklist from './useCaseWorklist';

function normalizeCase(item) {
  return {
    ...item,
    status: item.status || 'New',
    reviewer: item.reviewer || '',
    slides: Array.isArray(item.slides) ? item.slides : [],
    slide_count: Number.isFinite(item.slide_count) ? item.slide_count : (item.slides?.length || 0),
    review_notes: Array.isArray(item.review_notes) ? item.review_notes : [],
    review_history: Array.isArray(item.review_history) ? item.review_history : [],
  };
}

function statusOptions(current) {
  if (current === 'Reviewed') return ['In Review'];
  if (current === 'In Review') return ['Reviewed'];
  return ['In Review'];
}

function nextStatus(current) {
  return statusOptions(current)[0];
}

export default function App() {
  const { user, logout } = useAuth();
  
  
  
  
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedSlideId, setSelectedSlideId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [worklistTab, setWorklistTab] = useState('My Cases');
  const [statusFilter, setStatusFilter] = useState('All');
  const [reviewerFilter, setReviewerFilter] = useState('All');
  
  const [busy, setBusy] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState(null);
  const [wsiLimitMb, setWsiLimitMb] = useState(2048);
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('review');
  const [editingSlideId, setEditingSlideId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewerRef = useRef(null);

  const [compareSlideId, setCompareSlideId] = useState(null);
  const [syncViews, setSyncViews] = useState(false);
  const [zoom2, setZoom2] = useState(1);
  const [position2, setPosition2] = useState({ x: 0, y: 0 });
  const [dragStart2, setDragStart2] = useState({ x: 0, y: 0 });
  const [isDragging2, setIsDragging2] = useState(false);
  const viewerRef2 = useRef(null);
  



  const selectedCase = cases.find((item) => item.id === selectedCaseId) || null;
  const selectedSlide = selectedCase?.slides.find((slide) => slide.id === selectedSlideId) || null;
  const compareSlide = selectedCase?.slides.find((slide) => slide.id === compareSlideId) || null;

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch(`${API}/api/cases`);
      if (!response.ok) throw new Error('Could not load cases');
      const data = await response.json();
      const normalized = data.map(normalizeCase);
      setCases(normalized);
      setIsBackendHealthy(true);
      return normalized;
    } catch (error) {
      setIsBackendHealthy(false);
      toast.error(`Cannot connect to API (${error.message}).`);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      refresh().catch(() => {});
      apiFetch(`${API}/api/status`).then((r) => r.ok ? r.json() : null)
        .then((data) => data?.wsi_max_upload_mb && setWsiLimitMb(data.wsi_max_upload_mb))
        .catch(() => {});
    });
  }, [refresh, user]);

  const resetRasterView = () => {
    setZoom2(1);
    setPosition2({ x: 0, y: 0 });
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const selectCase = (item) => {
    setSelectedCaseId(item.id);
    setSelectedSlideId((item.slides || [])[0]?.id ?? null);
    setCompareSlideId(null);
    setEditingSlideId(null);
    setShowSlideForm(false);
    setInspectorTab('review');
    resetRasterView();
  };

  const selectSlide = (slide) => {
    setSelectedSlideId(slide.id);
    setEditingSlideId(null);
    resetRasterView();
  };

  const validateFile = (file) => {
    if (!file) return true;
    const isWsi = file.name.toLowerCase().endsWith('.svs');
    const limit = (isWsi ? wsiLimitMb : 10) * 1024 * 1024;
    if (file.size > limit) {
      toast.error(`File exceeds the ${isWsi ? wsiLimitMb : 10} MB limit.`);
      return false;
    }
    return true;
  };

  async function createCase(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const file = form.elements.image.files[0];
    if (!validateFile(file)) return;
    setBusy(true);
    toast(file ? 'Creating case and uploading first slide…' : 'Creating empty case…');
    try {
      const response = await apiFetch(`${API}/api/cases`, { method: 'POST', body: new FormData(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not create case');
      form.reset();
      await refresh();
      setSelectedCaseId(data.id);
      setSelectedSlideId(data.slides[0]?.id ?? null);
      toast.success(`Case “${data.case_id}” created.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function addSlide(event) {
    event.preventDefault();
    if (busy || !selectedCase) return;
    const form = event.currentTarget;
    const file = form.elements.image.files[0];
    if (!validateFile(file)) return;
    setBusy(true);
    toast('Uploading and validating slide…');
    try {
      const response = await apiFetch(`${API}/api/cases/${selectedCase.id}/slides`, {
        method: 'POST', body: new FormData(form),
      });
      const slide = await response.json();
      if (!response.ok) throw new Error(slide.detail || 'Slide upload failed');
      form.reset();
      await refresh();
      setSelectedSlideId(slide.id);
      setShowSlideForm(false);
      toast.success(`Slide “${slide.label}” is ready.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }


  async function saveSlideQc(event, slide) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = event.currentTarget;
    try {
      const data = {
        qc_status: form.elements.qc_status.value || null,
        qc_missing_tissue: form.elements.qc_missing_tissue.checked,
        qc_blur: form.elements.qc_blur.checked,
        qc_scan_artifact: form.elements.qc_scan_artifact.checked,
        qc_incorrect_label: form.elements.qc_incorrect_label.checked,
        qc_note: form.elements.qc_note.value
      };
      const response = await apiFetch(`${API}/api/slides/${slide.id}/qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Could not update QC');
      await refresh();
      setEditingSlideId(null);
      toast.success('Slide QC saved.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSlide(event, slide) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await apiFetch(`${API}/api/slides/${slide.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not update slide');
      await refresh();
      setEditingSlideId(null);
      toast.success('Slide details updated.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateReview(event, endpoint, successText) {
    event.preventDefault();
    if (busy || !selectedCase) return;
    setBusy(true);
    const form = event.currentTarget;
    try {
      const response = await apiFetch(`${API}/api/cases/${selectedCase.id}/${endpoint}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not update case');
      await refresh();
      toast.success(successText);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function addReviewNote(event) {
    event.preventDefault();
    if (busy || !selectedCase) return;
    setBusy(true);
    const form = event.currentTarget;
    try {
      const response = await apiFetch(`${API}/api/cases/${selectedCase.id}/review-notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not add review note');
      form.elements.note.value = '';
      await refresh();
      toast.success('Review note added.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const viewerError = useCallback((text) => toast.error(text), []);
  const reportMessage = useCallback(({ text, type }) => type === 'error' ? toast.error(text) : toast.success(text), []);
  const { filteredCases, reviewers } = useCaseWorklist(cases, {
    searchQuery, worklistTab, statusFilter, reviewerFilter, user,
  });
  const formatDate = (value) => {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  if (!user) return <Login />;
  return (
    <main id="main-content" className="layout">
      <header className="header">
        <div className="header-brand">
          <div className="logo-icon"><Microscope size={26} color="var(--primary)" /></div>
          <div><div className="title-row"><h1>Pathology workspace</h1></div>
            <p className="subtitle">Review cases and compare slides.</p></div>
        </div>
        <div className="header-actions">
          {user?.role === 'Admin' && (
            <Link to="/admin" className="btn-control-secondary admin-route-link">
              Admin
            </Link>
          )}
          <div className="backend-indicator">
            <span className={`status-dot ${isBackendHealthy ? 'online' : isBackendHealthy === false ? 'offline' : 'checking'}`} />
            <span>{isBackendHealthy ? 'Connected' : isBackendHealthy === false ? 'Offline' : 'Connecting…'}</span>
          </div>
          <div className="user-context"><span className="user-avatar" aria-hidden="true">{(user.display_name || user.username).slice(0, 1).toUpperCase()}</span><span><strong>{user.display_name || user.username}</strong><small>{user.role}</small></span></div>
          <button className="icon-button" onClick={logout} title="Log out" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <>
      <section className={`card form-card ${showCreateCase ? 'form-card--open' : ''}`}>
        <button type="button" className="form-card-toggle" onClick={() => setShowCreateCase((value) => !value)} aria-expanded={showCreateCase}>
          <span><Plus size={17} /><span><strong>Create case</strong><small>Add case details and an optional first slide.</small></span></span><ChevronDown size={18} />
        </button>
        {showCreateCase && <>
        <form onSubmit={createCase} className="upload-form">
          <div className="form-grid case-create-grid">
            <Field label="Case ID *"><input name="case_id" required maxLength={80} placeholder="DEMO-001" /></Field>
            <Field label="Case description"><input name="description" placeholder="Specimen or case notes" /></Field>
            <Field label="First slide label"><input name="slide_label" defaultValue="Slide 1" /></Field>
            <Field label="Optional first slide"><input name="image" type="file" accept="image/jpeg,image/png,.svs" /></Field>
            <button className="btn-primary" disabled={busy}><Plus size={18} /> Create case</button>
          </div>
        </form></>}
      </section>

      <section className="columns case-workspace">
        <aside className="sidebar-card">
          <div className="sidebar-title-row"><h2>Cases</h2><span className="case-count-pill">{cases.length}</span></div>
          <div className="worklist-tabs" role="tablist" aria-label="Case worklists">
            {['My Cases', 'Unassigned', 'Awaiting Review', 'Completed'].map((tab) => (
              <button key={tab} type="button" role="tab" aria-selected={worklistTab === tab} className={worklistTab === tab ? 'worklist-tab worklist-tab--active' : 'worklist-tab'} onClick={() => setWorklistTab(tab)}>{tab}</button>
            ))}
          </div>
          <div className="search-bar"><Search size={16} className="search-icon" />
            <input placeholder="Search cases…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          <div className="archive-filters">
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option><option>New</option><option>In Review</option><option>Reviewed</option>
            </select>
            <select aria-label="Filter by reviewer" value={reviewerFilter} onChange={(e) => setReviewerFilter(e.target.value)}>
              <option>All</option>{reviewers.map((reviewer) => <option key={reviewer}>{reviewer}</option>)}
            </select>
          </div>
          <div className="cases-list-scroll">
            {!cases.length ? <Empty icon={FileImage} title="No cases yet" text="Create a case above to begin." /> :
              !filteredCases.length ? <Empty icon={Search} title="No matching cases" text="Try another worklist or clear the filters." /> :
              filteredCases.map((item) => <button type="button" key={item.id}
                className={`case ${item.id === selectedCaseId ? 'case-active' : ''}`} aria-pressed={item.id === selectedCaseId} onClick={() => selectCase(item)}>
                <div className="case-item-header"><strong className="case-id">{item.case_id}</strong>
                  <span className="case-count-pill">{item.slide_count} slide{item.slide_count === 1 ? '' : 's'}</span></div>
                <p className="case-desc">{item.description || 'No case description'}</p>
                <div className="case-review-summary"><span className={`review-status status-${(item.status || 'New').toLowerCase().replace(' ', '-')}`}>{item.status || 'New'}</span>
                  <span><UserRound size={12} /> {item.reviewer || 'Unassigned'}</span></div>
                <div className="case-footer"><Calendar size={12} /> {formatDate(item.created_at)}</div>
              </button>)}
          </div>
        </aside>

        <section className="viewer-card multi-slide-card">
          {!selectedCase ? <div className="viewer-placeholder"><Empty icon={Layers} title="Select a case" text="Open a case to view its slide tray." /></div> : <>
            <div className="viewer-header">
              <div className="viewer-info-title"><Layers size={20} color="var(--primary)" /><h2>{selectedCase.case_id}</h2>
                <span className="specimen-tag">{selectedCase.slide_count} slides</span></div>
              <button type="button" className="btn-control-secondary" onClick={() => setShowSlideForm((value) => !value)}>
                <Upload size={15} /> Add slide</button>
            </div>

            <aside className="case-inspector">
              <div className="inspector-tabs" role="tablist" aria-label="Case details">
                <button type="button" role="tab" aria-selected={inspectorTab === 'review'} className={inspectorTab === 'review' ? 'inspector-tab inspector-tab--active' : 'inspector-tab'} onClick={() => setInspectorTab('review')}>Review and QC</button>
                <button type="button" role="tab" aria-selected={inspectorTab === 'report'} className={inspectorTab === 'report' ? 'inspector-tab inspector-tab--active' : 'inspector-tab'} onClick={() => setInspectorTab('report')}>Report</button>
              </div>
            {inspectorTab === 'review' && <section className="review-panel" key={`review-${selectedCase.id}`}>
              <div className="review-panel-title"><ClipboardCheck size={17} /><div><h3>Case review</h3>
                <span>Names are recorded as entered and do not provide authentication.</span></div></div>
              <div className="review-controls">
                <form onSubmit={(event) => updateReview(event, 'reviewer', 'Reviewer updated.')}>
                  <Field label="Assigned reviewer"><input name="reviewer" maxLength={120} defaultValue={selectedCase.reviewer} placeholder="Reviewer name" /></Field>
                  
                  <button className="btn-control-secondary" disabled={busy}>Assign</button>
                </form>
                <form onSubmit={(event) => updateReview(event, 'status', 'Case status updated.')}>
                  <Field label="Status"><select name="status" defaultValue={nextStatus(selectedCase.status)}>
                    {statusOptions(selectedCase.status).map((status) => <option key={status}>{status}</option>)}
                  </select></Field>
                  
                  <button className="btn-control-secondary" disabled={busy}>Change status</button>
                </form>
                <form className="review-note-form" onSubmit={addReviewNote}>
                  
                  <Field label="Review note *"><textarea name="note" required maxLength={4000} rows={2} placeholder="Add a case-level review note" /></Field>
                  <button className="btn-control-secondary" disabled={busy}>Add note</button>
                </form>
              </div>
              <div className="review-records">
                <details open><summary>Notes ({(selectedCase.review_notes || []).length})</summary>
                  {!(selectedCase.review_notes || []).length ? <p className="review-empty">No review notes yet.</p> :
                    selectedCase.review_notes.map((note) => <article key={note.id}><strong>{note.author}</strong><time dateTime={note.created_at}>{formatDate(note.created_at)}</time><p>{note.note}</p></article>)}
                </details>
                <details><summary><History size={13} /> History ({(selectedCase.review_history || []).length})</summary>
                  {!(selectedCase.review_history || []).length ? <p className="review-empty">No workflow changes yet.</p> :
                    selectedCase.review_history.map((entry) => <article key={entry.id}><strong>{entry.actor}</strong><time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                      <p>{entry.change_type === 'status' ? 'Status' : 'Reviewer'}: {entry.previous_value || 'Unassigned'} → {entry.new_value || 'Unassigned'}</p></article>)}
                </details>
              </div>
            </section>}

            {inspectorTab === 'report' && <ReportEditor selectedCase={selectedCase} selectSlide={selectSlide} setMessage={reportMessage} />}
            </aside>

            {showSlideForm && <form className="add-slide-form" onSubmit={addSlide}>
              <Field label="Slide label *"><input name="label" required maxLength={120} placeholder="Slide A H&E" /></Field>
              <Field label="Stain"><input name="stain" placeholder="H&E, IHC, PAS…" /></Field>
              <Field label="Specimen description"><input name="specimen_description" placeholder="Block, level, tissue…" /></Field>
              <Field label={`File (JPG/PNG 10 MB, SVS ${wsiLimitMb} MB) *`}><input name="image" required type="file" accept="image/jpeg,image/png,.svs" /></Field>
              <button className="btn-primary" disabled={busy}><Upload size={16} /> {busy ? 'Uploading…' : 'Upload Slide'}</button>
            </form>}

            {!(selectedCase.slides || []).length ? <div className="viewer-placeholder case-empty">
              <Empty icon={FileImage} title="This case has no slides" text="Use Add Slide to attach a JPG, PNG, or SVS file." />
            </div> : <>
              <div className="slide-tray" aria-label="Case slide tray">
                {selectedCase.slides.map((slide) => <div key={slide.id} className={`tray-item ${slide.id === selectedSlideId ? 'tray-active' : ''} ${slide.id === compareSlideId ? 'tray-compare-active' : ''}`}>
                  <button type="button" className="tray-select" onClick={() => selectSlide(slide)}>
                    <img src={slide.thumbnail_url} alt={`${slide.label} thumbnail`} loading="lazy" />
                    <span className="tray-copy"><strong>{slide.label}</strong><small>{slide.stain || 'Unspecified stain'}</small>
                      <span><b>{slide.file_type === 'wsi' ? 'WSI' : slide.format}</b><i className={`upload-state ${slide.upload_state}`}>{slide.upload_state}</i>
                      {slide.qc_status && <span className={`qc-badge qc-${slide.qc_status.replace(/\s+/g, '-').toLowerCase()}`}>{slide.qc_status}</span>}
                      </span></span>
                  </button>
                  <button type="button" className="tray-compare" aria-label={compareSlideId === slide.id ? `Stop comparing ${slide.label}` : `Compare ${slide.label}`} aria-pressed={compareSlideId === slide.id} title={compareSlideId === slide.id ? 'Close compare' : 'Compare side-by-side'} onClick={() => setCompareSlideId(c => c === slide.id ? null : slide.id)}><Columns size={14} /></button>
                  <button type="button" className="tray-edit" aria-label={`Edit ${slide.label}`} title="Edit slide details" onClick={() => setEditingSlideId(slide.id)}><Edit3 size={14} /></button>
                </div>)}
              </div>

              {selectedSlide && editingSlideId === selectedSlide.id && <form className="edit-slide-form" onSubmit={(event) => saveSlide(event, selectedSlide)}>
                <Field label="Label"><input name="label" required defaultValue={selectedSlide.label} /></Field>
                <Field label="Stain"><input name="stain" defaultValue={selectedSlide.stain} /></Field>
                <Field label="Specimen description"><input name="specimen_description" defaultValue={selectedSlide.specimen_description} /></Field>
                <button className="btn-primary" disabled={busy}>Save</button>
                <button type="button" className="btn-control-secondary" onClick={() => setEditingSlideId(null)}>Cancel</button>
              </form>}

              {selectedSlide && editingSlideId === selectedSlide.id && ['Technician', 'Admin'].includes(user?.role) && <form className="edit-slide-form qc-form" onSubmit={(event) => saveSlideQc(event, selectedSlide)}>
                <h4 className="qc-title">Quality control</h4>
                <Field label="Status">
                  <select name="qc_status" defaultValue={selectedSlide.qc_status || ''}>
                    <option value="">None</option>
                    <option value="Pass">Pass</option>
                    <option value="Needs rescan">Needs rescan</option>
                    <option value="Cannot assess">Cannot assess</option>
                  </select>
                </Field>
                <div className="qc-defects">
                  <label><input type="checkbox" name="qc_missing_tissue" defaultChecked={selectedSlide.qc_missing_tissue} /> Missing tissue</label>
                  <label><input type="checkbox" name="qc_blur" defaultChecked={selectedSlide.qc_blur} /> Blur</label>
                  <label><input type="checkbox" name="qc_scan_artifact" defaultChecked={selectedSlide.qc_scan_artifact} /> Scan artifact</label>
                  <label><input type="checkbox" name="qc_incorrect_label" defaultChecked={selectedSlide.qc_incorrect_label} /> Incorrect label</label>
                </div>
                <Field label="Note (optional)"><input name="qc_note" defaultValue={selectedSlide.qc_note || ''} /></Field>
                <button className="btn-primary" disabled={busy}>Save QC</button>
              </form>}

              
              {selectedSlide && !compareSlideId && <SlideViewer key={selectedSlide.id} slide={selectedSlide} zoom={zoom} setZoom={setZoom}
                position={position} setPosition={setPosition} dragStart={dragStart} setDragStart={setDragStart}
                isDragging={isDragging} setIsDragging={setIsDragging} viewerRef={viewerRef}
                reset={resetRasterView} onError={viewerError} />}

              {selectedSlide && compareSlideId && <div className="compare-container">
                <div className="compare-toolbar">
                  <label className="toggle-control"><input type="checkbox" checked={syncViews} onChange={e => setSyncViews(e.target.checked)} /><span>Synchronize navigation</span></label>
                  <button className="btn-control-secondary" onClick={() => setCompareSlideId(null)}><X size={15} /> Close Compare</button>
                </div>
                <div className="compare-panels">
                  <div className="compare-panel primary-panel">
                    <SlideViewer key={selectedSlide.id} slide={selectedSlide} zoom={zoom} setZoom={setZoom}
                      position={position} setPosition={setPosition} dragStart={dragStart} setDragStart={setDragStart}
                      isDragging={isDragging} setIsDragging={setIsDragging} viewerRef={viewerRef}
                      reset={resetRasterView} onError={viewerError} syncViews={syncViews} syncedViewerRef={viewerRef2} isPrimary={true} />
                  </div>
                  <div className="compare-panel secondary-panel">
                    {compareSlide ? <SlideViewer key={compareSlide.id + '-compare'} slide={compareSlide} zoom={syncViews ? zoom : zoom2} setZoom={syncViews ? setZoom : setZoom2}
                      position={syncViews ? position : position2} setPosition={syncViews ? setPosition : setPosition2} dragStart={dragStart2} setDragStart={setDragStart2}
                      isDragging={isDragging2} setIsDragging={setIsDragging2} viewerRef={viewerRef2}
                      reset={resetRasterView} onError={viewerError} syncViews={syncViews} syncedViewerRef={viewerRef} isPrimary={false} /> :
                      <div className="viewer-placeholder">Slide not found</div>}
                  </div>
                </div>
              </div>}

            </>}
          </>}
        </section>
      </section>
    </>
    </main>
  );
}
