import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileImage, LayoutList, MoreHorizontal, Search, SlidersHorizontal, Table2, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { caseService } from '../../services/caseService';
import { platformService } from '../../services/platformService';
import Modal from '../../components/Modal/Modal';
import { notifyClinicalDataChanged, subscribeToClinicalDataChanges } from '../../services/clinicalDataEvents';
import { isIntakeRole } from '../../config/roles';
import { useAuth } from '../auth/AuthProvider';
import './SlideLibrary.css';

const slideStatus = (caseItem) => caseItem.status === 'Reviewed' ? 'Reviewed' : caseItem.status === 'In Review' ? 'In review' : 'Awaiting review';

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') return 'Not recorded';
  const value = Number(bytes);
  if (!Number.isFinite(value)) return 'Not recorded';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function SlideLibrary() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('All');
  const [view, setView] = useState('table');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [slidePendingRemoval, setSlidePendingRemoval] = useState(null);
  const [actionMenuSlideId, setActionMenuSlideId] = useState(null);
  const actionMenuRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadCases = (signal) => caseService.list(signal)
      .then((items) => setCases(Array.isArray(items) ? items : items.items || []))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message); });
    loadCases(controller.signal);
    const unsubscribe = subscribeToClinicalDataChanges(() => loadCases());
    return () => { controller.abort(); unsubscribe(); };
  }, []);

  useEffect(() => {
    const closeMenu = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) setActionMenuSlideId(null);
    };
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, []);

  const slides = useMemo(() => cases.flatMap((caseItem) => (caseItem.slides || []).map((slide) => ({
    ...slide,
    image_url: slide.thumbnail_url || slide.image_url,
    caseId: caseItem.id,
    caseLabel: caseItem.case_id,
    caseDescription: caseItem.description,
    status: slideStatus(caseItem),
  }))), [cases]);

  const filtered = slides.filter((slide) => {
    const text = `${slide.label || ''} ${slide.caseLabel || ''} ${slide.stain || ''} ${slide.specimen_description || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (format === 'All' || slide.file_type === format);
  });
  const canRemoveSlides = isIntakeRole(user?.role);
  const activeSlide = selected;

  async function removeSlide() {
    const target = slidePendingRemoval;
    if (!canRemoveSlides || !target || removing) return;
    setRemoving(true);
    setError('');
    try {
      await platformService.deleteSlide(target.id);
      setCases((current) => current.map((caseItem) => caseItem.id === target.caseId ? {
        ...caseItem,
        slides: (caseItem.slides || []).filter((slide) => slide.id !== target.id),
        slide_count: Math.max(0, (caseItem.slide_count || 1) - 1),
      } : caseItem));
      setSlidePendingRemoval(null);
      setSelected(null);
      notifyClinicalDataChanged({ type: 'slide-deleted', slideId: target.id, caseId: target.caseId });
    } catch (err) {
      setError(err.message || 'Unable to remove slide.');
    } finally {
      setRemoving(false);
    }
  }

  return <main className="slide-library" id="main-content">
    <section className="slide-library__filters" aria-label="Slide library filters"><label className="slide-library__search"><Search size={17} /><span className="sr-only">Search slides</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search slide ID, case ID, stain, or specimen" /></label><label className="slide-library__filter"><SlidersHorizontal size={16} /><span className="sr-only">File format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="All">All formats</option><option value="wsi">Whole-slide images</option><option value="raster">Image files</option></select></label><div className="slide-library__view-toggle" role="group" aria-label="Slide display"><button type="button" className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')} aria-label="Table view"><Table2 size={16} /></button><button type="button" className={view === 'cards' ? 'is-active' : ''} onClick={() => setView('cards')} aria-label="Card view"><LayoutList size={16} /></button></div></section>
    {error && <p className="slide-library__error" role="alert">Unable to load slides: {error}</p>}
    <p className="slide-library__count">{filtered.length} slide{filtered.length === 1 ? '' : 's'}</p>
    {view === 'table' ? <div className="slide-library__table-wrap"><table className="slide-library__table"><thead><tr><th>Slide</th><th>Case</th><th>Specimen / stain</th><th>Format</th><th>Size</th><th>Status</th><th>Uploaded</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((slide) => <tr key={slide.id}><td><Link className="slide-library__slide-cell" to={`/cases?case=${slide.caseId}&slide=${slide.id}`}><span className="slide-library__thumbnail">{slide.image_url ? <img src={slide.image_url} alt="" /> : <FileImage size={18} />}</span><span><strong>{slide.label || `Slide ${slide.id}`}</strong><small>Slide ID {slide.id}</small></span></Link></td><td><Link className="slide-library__case-link" to={`/cases?case=${slide.caseId}`}>{slide.caseLabel || `Case ${slide.caseId}`}</Link></td><td><strong>{slide.specimen_description || slide.caseDescription || 'Not recorded'}</strong><small>{slide.stain || 'Stain not recorded'}</small></td><td>{slide.format || slide.file_type?.toUpperCase() || 'Not recorded'}</td><td>{formatFileSize(slide.file_size)}</td><td><span className={`slide-library__status slide-library__status--${slide.status.toLowerCase().replace(/\s+/g, '-')}`}>{slide.status}</span></td><td>{formatDate(slide.created_at)}</td><td><div className="slide-library__row-actions" ref={actionMenuSlideId === slide.id ? actionMenuRef : null}><button type="button" className="slide-library__row-action" onClick={() => setActionMenuSlideId((current) => current === slide.id ? null : slide.id)} aria-label={`Actions for ${slide.label || `slide ${slide.id}`}`} aria-expanded={actionMenuSlideId === slide.id}><MoreHorizontal size={18} /></button>{actionMenuSlideId === slide.id && <div className="slide-library__action-menu" role="menu"><Link to={`/cases?case=${slide.caseId}&slide=${slide.id}`} role="menuitem" onClick={() => setActionMenuSlideId(null)}><Eye size={15} />Open in viewer</Link>{canRemoveSlides && <button type="button" role="menuitem" onClick={() => { setActionMenuSlideId(null); setSlidePendingRemoval(slide); }}><Trash2 size={15} />Remove slide</button>}</div>}</div></td></tr>)}{!filtered.length && <tr><td colSpan="8"><div className="slide-library__empty"><FileImage size={25} /><strong>No slides found</strong><span>Adjust the search or add a slide through a case.</span></div></td></tr>}</tbody></table></div> : <div className="slide-library__cards-layout"><div className="slide-library__grid">{filtered.map((slide) => <button type="button" className={`slide-card${activeSlide?.id === slide.id ? ' is-selected' : ''}`} key={slide.id} onClick={() => setSelected(slide)}><div className="slide-card__image">{slide.image_url ? <img src={slide.image_url} alt="" /> : <FileImage size={26} />}<span>{slide.status}</span></div><strong>{slide.label || `Slide ${slide.id}`}</strong><small>Case: {slide.caseLabel}</small><p>{slide.specimen_description || 'Specimen details not recorded'}</p><footer>{slide.file_type?.toUpperCase() || 'Image'} <span>·</span> {slide.stain || 'Stain not recorded'}</footer></button>)}{!filtered.length && <div className="slide-library__empty"><FileImage size={25} /><strong>No slides found</strong><span>Adjust the search or add a slide through a case.</span></div>}</div><aside className="slide-library__details">{activeSlide ? <><button type="button" className="slide-library__details-close" onClick={() => setSelected(null)} aria-label="Clear selected slide"><X size={16} /></button><div className="slide-library__details-image">{activeSlide.image_url ? <img src={activeSlide.image_url} alt={`Preview of ${activeSlide.label || 'slide'}`} /> : <FileImage size={30} />}</div><div className="slide-library__details-title"><h2>{activeSlide.label || `Slide ${activeSlide.id}`}</h2><span className={`slide-library__status slide-library__status--${activeSlide.status.toLowerCase().replace(/\s+/g, '-')}`}>{activeSlide.status}</span></div><Link to={`/cases?case=${activeSlide.caseId}&slide=${activeSlide.id}`} className="btn-primary route-link"><Eye size={16} />Open in viewer</Link>{canRemoveSlides && <button type="button" className="slide-library__details-remove" onClick={() => setSlidePendingRemoval(activeSlide)} disabled={removing}><Trash2 size={15} />{removing ? 'Removing…' : 'Remove slide'}</button>}<section className="slide-library__metadata"><h3>Metadata</h3><dl><div><dt>Slide ID</dt><dd>{activeSlide.id}</dd></div><div><dt>Case ID</dt><dd><Link to={`/cases?case=${activeSlide.caseId}`}>{activeSlide.caseLabel}</Link></dd></div><div><dt>File name</dt><dd>{activeSlide.filename || 'Not recorded'}</dd></div><div><dt>File format</dt><dd>{activeSlide.format || activeSlide.file_type?.toUpperCase() || 'Not recorded'}</dd></div><div><dt>File size</dt><dd>{formatFileSize(activeSlide.file_size)}</dd></div><div><dt>Dimensions</dt><dd>{activeSlide.width && activeSlide.height ? `${Number(activeSlide.width).toLocaleString()} × ${Number(activeSlide.height).toLocaleString()} pixels` : 'Not recorded'}</dd></div><div><dt>Image levels</dt><dd>{activeSlide.level_count || 'Not recorded'}</dd></div><div><dt>Stain</dt><dd>{activeSlide.stain || 'Not recorded'}</dd></div><div><dt>Specimen type</dt><dd>{activeSlide.specimen_description || activeSlide.caseDescription || 'Not recorded'}</dd></div><div><dt>Upload date</dt><dd>{formatDate(activeSlide.created_at)}</dd></div><div><dt>Processing status</dt><dd>{activeSlide.upload_state || 'Not recorded'}</dd></div></dl></section></> : <div className="slide-library__details-empty"><FileImage size={28} /><p>Select a slide to view its metadata.</p></div>}</aside></div>}
    <Modal open={canRemoveSlides && Boolean(slidePendingRemoval)} title="Remove slide" onClose={() => !removing && setSlidePendingRemoval(null)} footer={<><button type="button" className="modal-button modal-button--secondary" disabled={removing} onClick={() => setSlidePendingRemoval(null)}>Cancel</button><button type="button" className="modal-button btn-delete" disabled={removing} onClick={removeSlide}>{removing ? 'Removing…' : 'Remove slide'}</button></>}><p className="confirmation-copy">Remove <strong>{slidePendingRemoval?.label || `Slide ${slidePendingRemoval?.id || ''}`}</strong>? This removes its annotations and analysis records. The source file is moved to protected deleted storage.</p></Modal>
  </main>;
}
