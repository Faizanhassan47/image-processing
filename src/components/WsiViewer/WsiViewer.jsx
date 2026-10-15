import { useCallback, useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { Edit3, Eye, EyeOff, Expand, Maximize2, Minimize2, RotateCcw, Square, Trash2, PenTool, MoveDiagonal } from 'lucide-react';
import '../SlideViewer/SlideViewer.css';
import './WsiViewer.css';
import { API_BASE_URL as API } from '../../config';
import { apiFetch } from '../../api';
import Modal from '../Modal/Modal';

export default function WsiViewer({ slide, onError, syncViews, syncedViewerRef, externalViewerRef }) {
  const elementRef = useRef(null);
  const workspaceRef = useRef(null);
  const viewerRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(true);
  const [drawMode, setDrawMode] = useState(null); // 'rectangle', 'polygon', 'arrow', or null
  const [visible, setVisible] = useState(true);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const svgOverlayRef = useRef(null);
  
  // For rendering SVG aligned with OpenSeadragon
  const [viewState, setViewState] = useState({ zoom: 1, pan: {x: 0, y: 0} });
  const [draftGeometry, setDraftGeometry] = useState(null);

  useEffect(() => {
    const changed = () => {
      setFullscreen(document.fullscreenElement === workspaceRef.current);
      requestAnimationFrame(() => {
        const viewer = viewerRef.current;
        const element = elementRef.current;
        if (viewer?.viewport && element) {
          viewer.viewport.resize(new OpenSeadragon.Point(element.clientWidth, element.clientHeight), true);
          viewer.forceRedraw();
        }
      });
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  const loadAnnotations = useCallback(async (signal) => {
    setAnnotationsLoading(true);
    try {
      const response = await apiFetch(`${API}/api/slides/${slide.id}/annotations`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not load annotations');
      setAnnotations(data);
    } catch (error) {
      if (error.name !== 'AbortError') onError(`Could not load annotations: ${error.message}`);
    } finally {
      if (!signal?.aborted) setAnnotationsLoading(false);
    }
  }, [slide.id, onError]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) loadAnnotations(controller.signal);
    });
    return () => controller.abort();
  }, [loadAnnotations]);

  useEffect(() => {
    let dziUrl = slide.dzi_url;
    if (dziUrl && dziUrl.startsWith('/') && API) {
      dziUrl = `${API}${dziUrl}`;
    }

    const viewer = OpenSeadragon({
      element: elementRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      animationTime: 0.7,
      blendTime: 0.1,
      constrainDuringPan: true,
      visibilityRatio: 0.5,
      minZoomImageRatio: 0.8,
      maxZoomPixelRatio: 2,
      crossOriginPolicy: 'Anonymous',
      ajaxWithCredentials: true,
    });
    viewerRef.current = viewer;
    
    viewer.addHandler('open', () => setViewerReady(true));
    viewer.addHandler('open-failed', (event) => onError(`Could not load slide: ${event.message || 'descriptor request failed'}`));
    viewer.addHandler('tile-load-failed', (event) => onError(`A slide tile failed to load${event.message ? `: ${event.message}` : ''}`));
    
    // Track viewport for SVG synchronization
    const updateViewState = () => {
      if (!viewer.viewport) return;
      setViewState({
        zoom: viewer.viewport.getZoom(true),
        pan: viewer.viewport.getCenter(true)
      });
    };
    viewer.addHandler('update-viewport', updateViewState);
    viewer.addHandler('animation', updateViewState);
    
    return () => {
      setViewerReady(false);
      viewerRef.current = null;
      viewer.destroy();
    };
  }, [slide.id, slide.dzi_url, onError]);

  useEffect(() => {
    if (externalViewerRef) {
      externalViewerRef.current = viewerRef.current;
    }
  }, [viewerReady, externalViewerRef]);

  useEffect(() => {
    if (!syncViews || !viewerReady || !viewerRef.current || !syncedViewerRef?.current) return;
    const v1 = viewerRef.current;
    
    const handler = () => {
      const v2 = syncedViewerRef.current;
      if (!v2 || v1.isSyncing) return;
      
      const item1 = v1.world?.getItemAt(0);
      const item2 = v2.world?.getItemAt(0);
      if (!item1 || !item2) return;

      v2.isSyncing = true;
      
      const center1 = v1.viewport.getCenter();
      const size1 = item1.getContentSize();
      const size2 = item2.getContentSize();
      
      const fracX = center1.x;
      const fracY = size1.x ? center1.y / (size1.y / size1.x) : 0;
      
      const targetX = fracX;
      const targetY = size2.x ? fracY * (size2.y / size2.x) : 0;
      
      v2.viewport.zoomTo(v1.viewport.getZoom(), null, true);
      v2.viewport.panTo(new OpenSeadragon.Point(targetX, targetY), true);
      setTimeout(() => { v2.isSyncing = false; }, 50);
    };

    v1.addHandler('pan', handler);
    v1.addHandler('zoom', handler);

    return () => {
      v1.removeHandler('pan', handler);
      v1.removeHandler('zoom', handler);
    };
  }, [syncViews, viewerReady, syncedViewerRef]);

  // SVG coordinate conversions
  const imageToViewport = useCallback((x, y) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.world.getItemAt(0)) return {x:0, y:0};
    const vp = viewer.world.getItemAt(0).imageToViewportCoordinates(x, y);
    const pixel = viewer.viewport.pixelFromPoint(vp, true);
    return { x: pixel.x, y: pixel.y };
  }, [viewState]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const host = svgOverlayRef.current;
    if (!viewerReady || !viewer || !host) return undefined;
    
    // Disable panning when drawing
    viewer.setMouseNavEnabled(!drawMode);
    
    let drawingState = null; // internal state: { type, points, startPoint }

    const getImagePoint = (event) => {
      const bounds = host.getBoundingClientRect();
      const pixel = new OpenSeadragon.Point(event.clientX - bounds.left, event.clientY - bounds.top);
      const viewportPoint = viewer.viewport.pointFromPixel(pixel);
      const point = viewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);
      return {
        x: Math.max(0, Math.min(slide.width, point.x)),
        y: Math.max(0, Math.min(slide.height, point.y)),
      };
    };

    const down = (event) => {
      if (event.button !== 0 || !drawMode) return;
      event.preventDefault();
      event.stopPropagation();
      host.setPointerCapture?.(event.pointerId);
      
      const pt = getImagePoint(event);
      
      if (drawMode === 'polygon') {
        if (!drawingState) {
          drawingState = { type: 'polygon', points: [pt] };
        } else {
          drawingState.points.push(pt);
        }
        setDraftGeometry({ ...drawingState, cursor: pt });
      } else if (drawMode === 'rectangle' || drawMode === 'arrow') {
        drawingState = { type: drawMode, points: [pt, pt] };
        setDraftGeometry({ ...drawingState });
      }
    };

    const move = (event) => {
      if (!drawingState || !drawMode) return;
      const pt = getImagePoint(event);
      
      if (drawMode === 'polygon') {
        setDraftGeometry({ ...drawingState, cursor: pt });
      } else if (drawMode === 'rectangle' || drawMode === 'arrow') {
        drawingState.points[1] = pt;
        setDraftGeometry({ ...drawingState });
      }
    };

    const up = (event) => {
      if (!drawingState || drawMode === 'polygon') return;
      event.preventDefault();
      event.stopPropagation();
      host.releasePointerCapture?.(event.pointerId);
      
      const pt = getImagePoint(event);
      drawingState.points[1] = pt;
      
      // Complete rectangle or arrow
      const [p1, p2] = drawingState.points;
      
      let finalGeom = null;
      if (drawMode === 'rectangle') {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        if (w >= 1 && h >= 1) {
           finalGeom = { annotation_type: 'rectangle', x, y, width: w, height: h };
        }
      } else if (drawMode === 'arrow') {
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        if (dx >= 1 || dy >= 1) {
           finalGeom = { annotation_type: 'arrow', points: [[p1.x, p1.y], [p2.x, p2.y]] };
        }
      }
      
      if (finalGeom) {
        setDraft({ ...finalGeom, label: '', note: '', color: '#e85d75' });
        setDrawMode(null);
      }
      
      drawingState = null;
      setDraftGeometry(null);
    };
    
    const dblclick = (event) => {
       if (drawMode === 'polygon' && drawingState && drawingState.points.length >= 3) {
         event.preventDefault();
         event.stopPropagation();
         let pts = [...drawingState.points];
         // A double-click will register an extra 'down' event immediately before the dblclick.
         // If the last point is very close to the second-to-last, it's a double-click artifact.
         if (pts.length >= 3) {
             const last = pts[pts.length - 1];
             const secondLast = pts[pts.length - 2];
             // Compare in screen pixels to avoid zoom level issues
             const viewer = viewerRef.current;
             const vp1 = viewer.world.getItemAt(0).imageToViewportCoordinates(last.x, last.y);
             const p1 = viewer.viewport.pixelFromPoint(vp1);
             const vp2 = viewer.world.getItemAt(0).imageToViewportCoordinates(secondLast.x, secondLast.y);
             const p2 = viewer.viewport.pixelFromPoint(vp2);
             if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 5) {
                 pts.pop();
             }
         }
         const finalPts = pts.map(p => [p.x, p.y]);
         setDraft({ annotation_type: 'polygon', points: finalPts, label: '', note: '', color: '#e85d75' });
         setDrawMode(null);
         drawingState = null;
         setDraftGeometry(null);
       }
    };
    
    const keydown = (e) => {
      if (e.key === 'Escape' && drawingState) {
        drawingState = null;
        setDraftGeometry(null);
      }
    };

    host.addEventListener('pointerdown', down, true);
    host.addEventListener('pointermove', move, true);
    host.addEventListener('pointerup', up, true);
    host.addEventListener('dblclick', dblclick, true);
    document.addEventListener('keydown', keydown);
    
    return () => {
      host.removeEventListener('pointerdown', down, true);
      host.removeEventListener('pointermove', move, true);
      host.removeEventListener('pointerup', up, true);
      host.removeEventListener('dblclick', dblclick, true);
      document.removeEventListener('keydown', keydown);
      if (viewerRef.current === viewer) viewer.setMouseNavEnabled(true);
    };
  }, [drawMode, slide.height, slide.width, viewerReady]);

  const fit = () => viewerRef.current?.viewport.goHome(true);
  const reset = () => { fit(); viewerRef.current?.viewport.setRotation(0); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === workspaceRef.current) await document.exitFullscreen();
      else await workspaceRef.current?.requestFullscreen();
    } catch (error) {
      onError(`Could not change fullscreen mode: ${error.message}`);
    }
  };
  const goTo = (annotation) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    
    let rect;
    if (annotation.annotation_type === 'rectangle' && annotation.width) {
       rect = new OpenSeadragon.Rect(annotation.x, annotation.y, annotation.width, annotation.height);
    } else if (annotation.points && Array.isArray(annotation.points) && annotation.points.length > 0) {
       let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
       annotation.points.forEach(([x, y]) => {
         minX = Math.min(minX, x); minY = Math.min(minY, y);
         maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
       });
       rect = new OpenSeadragon.Rect(minX, minY, maxX - minX, maxY - minY);
    }
    
    if (rect) {
      const item = viewer.world.getItemAt(0);
      const vpRect = item.imageToViewportRectangle(rect);
      viewer.viewport.fitBounds(vpRect, true);
    }
  };

  async function saveNew(event) {
    event.preventDefault();
    setSaving(true);
    const details = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await apiFetch(`${API}/api/slides/${slide.id}/annotations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, ...details }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not save annotation');
      setAnnotations((current) => [...current, data]);
      setDraft(null);
    } catch (error) { onError(`Could not save annotation: ${error.message}`); }
    finally { setSaving(false); }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/api/slides/${slide.id}/annotations/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not update annotation');
      setAnnotations((current) => current.map((item) => item.id === data.id ? data : item));
      setEditing(null);
    } catch (error) { onError(`Could not update annotation: ${error.message}`); }
    finally { setSaving(false); }
  }

  async function remove(annotation) {
    try {
      const response = await apiFetch(`${API}/api/slides/${slide.id}/annotations/${annotation.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).detail || 'Delete failed');
      setAnnotations((current) => current.filter((item) => item.id !== annotation.id));
      if (editing?.id === annotation.id) setEditing(null);
      setDeleteTarget(null);
    } catch (error) { onError(`Could not delete annotation: ${error.message}`); }
  }

  const renderShape = (geom, color, isDraft) => {
    if (geom.annotation_type === 'rectangle' || geom.type === 'rectangle') {
       let x, y, w, h;
       if (isDraft) {
          x = Math.min(geom.points[0].x, geom.points[1].x);
          y = Math.min(geom.points[0].y, geom.points[1].y);
          w = Math.abs(geom.points[1].x - geom.points[0].x);
          h = Math.abs(geom.points[1].y - geom.points[0].y);
       } else {
          x = geom.x; y = geom.y; w = geom.width; h = geom.height;
       }
       const p1 = imageToViewport(x, y);
       const p2 = imageToViewport(x + w, y + h);
       return <rect x={p1.x} y={p1.y} width={p2.x - p1.x} height={p2.y - p1.y} fill={`${color}33`} stroke={color} strokeWidth="2" />;
    } else if (geom.annotation_type === 'polygon' || geom.type === 'polygon') {
       let pts;
       if (isDraft) {
          pts = [...geom.points, geom.cursor].filter(Boolean).map(p => imageToViewport(p.x, p.y));
       } else {
          pts = geom.points.map(p => imageToViewport(p[0], p[1]));
       }
       const ptStr = pts.map(p => `${p.x},${p.y}`).join(' ');
       return <polygon points={ptStr} fill={`${color}33`} stroke={color} strokeWidth="2" strokeDasharray={isDraft ? "5,5" : "none"} />;
    } else if (geom.annotation_type === 'arrow' || geom.type === 'arrow') {
       let p1, p2;
       if (isDraft) {
          p1 = imageToViewport(geom.points[0].x, geom.points[0].y);
          p2 = imageToViewport(geom.points[1].x, geom.points[1].y);
       } else {
          p1 = imageToViewport(geom.points[0][0], geom.points[0][1]);
          p2 = imageToViewport(geom.points[1][0], geom.points[1][1]);
       }
       return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="3" markerEnd={`url(#arrowhead-${isDraft ? 'draft' : geom.id})`} />;
    }
  };

  return (
    <div className="wsi-annotation-workspace" ref={workspaceRef}>
      <div className="viewer-canvas-container">
        <div className="viewer-hint-bar">
          <span>{drawMode ? `Drawing ${drawMode}. ESC to cancel.` : 'Scroll to zoom • Drag to pan'}</span>
          <div className="wsi-controls">
            <button type="button" className={`btn-control-secondary ${drawMode === 'rectangle' ? 'tool-active' : ''}`} onClick={() => setDrawMode(drawMode === 'rectangle' ? null : 'rectangle')} title="Draw Rectangle">
              <Square size={15} />
            </button>
            <button type="button" className={`btn-control-secondary ${drawMode === 'polygon' ? 'tool-active' : ''}`} onClick={() => setDrawMode(drawMode === 'polygon' ? null : 'polygon')} title="Draw Polygon">
              <PenTool size={15} />
            </button>
            <button type="button" className={`btn-control-secondary ${drawMode === 'arrow' ? 'tool-active' : ''}`} onClick={() => setDrawMode(drawMode === 'arrow' ? null : 'arrow')} title="Draw Arrow">
              <MoveDiagonal size={15} />
            </button>
            
            <div className="v-divider" aria-hidden="true" />
            
            <button type="button" className="btn-control-secondary" aria-pressed={!visible} onClick={() => setVisible((value) => !value)}>
              {visible ? <EyeOff size={15} /> : <Eye size={15} />} {visible ? 'Hide' : 'Show'}
            </button>
            <button type="button" className="btn-control-secondary" onClick={fit}><Maximize2 size={15} /> Fit</button>
            <button type="button" className="btn-control-secondary" onClick={reset}><RotateCcw size={15} /> Reset</button>
            <button type="button" className="btn-control-secondary" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 size={15} /> : <Expand size={15} />} {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>
        
        <div className="wsi-stage">
          <div className={`wsi-viewer ${drawMode ? 'drawing-mode' : ''}`} ref={elementRef} aria-label={`Whole-slide viewer for ${slide.label}`} />
          
          <svg ref={svgOverlayRef} className={`annotation-svg-overlay ${drawMode ? 'drawing-active' : ''}`}>
             <defs>
               <marker id="arrowhead-draft" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                 <polygon points="0 0, 10 3.5, 0 7" fill="#e85d75" />
               </marker>
               {visible && annotations.map(a => (
                 <marker key={`marker-${a.id}`} id={`arrowhead-${a.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                   <polygon points="0 0, 10 3.5, 0 7" fill={a.color} />
                 </marker>
               ))}
             </defs>
             {visible && annotations.map((annotation) => (
                <g key={annotation.id} className="annotation-shape" onClick={() => goTo(annotation)}>
                   <title>{annotation.label}</title>
                   {renderShape(annotation, annotation.color, false)}
                </g>
             ))}
             {draftGeometry && renderShape(draftGeometry, '#e85d75', true)}
          </svg>
        </div>
        
        {!viewerReady && <div className="viewer-loading"><span className="loading-spinner" /> Loading slide tiles…</div>}
      </div>

      <aside className="annotation-panel">
        <div className="annotation-panel-heading"><div><h3>Annotations</h3><span>{annotations.length} items</span></div></div>
        {draft && <AnnotationForm title="New annotation" values={draft} onSubmit={saveNew} onCancel={() => setDraft(null)} saving={saving} />}
        {editing && <AnnotationForm title="Edit annotation" values={editing} onSubmit={saveEdit} onCancel={() => setEditing(null)} saving={saving} />}
        {annotationsLoading ? <p className="annotation-empty">Loading annotations…</p> : !annotations.length ?
          <p className="annotation-empty">No annotations yet. Choose a tool to mark a region.</p> :
          <div className="annotation-list">{annotations.map((annotation) => <div className="annotation-item" key={annotation.id}>
            <button type="button" className="annotation-open" onClick={() => goTo(annotation)}>
              <span className="annotation-swatch"><svg aria-hidden="true" viewBox="0 0 8 24"><rect width="8" height="24" rx="3" fill={annotation.color} /></svg></span>
              <span><strong>{annotation.label}</strong><small>{annotation.note || 'No note'}</small></span>
            </button>
            <div className="annotation-actions">
              <button type="button" title="Edit annotation" onClick={() => setEditing(annotation)}><Edit3 size={14} /></button>
              <button type="button" title="Delete annotation" onClick={() => setDeleteTarget(annotation)}><Trash2 size={14} /></button>
            </div>
          </div>)}</div>}
      </aside>
      <Modal
        open={Boolean(deleteTarget)}
        title="Delete annotation"
        onClose={() => setDeleteTarget(null)}
        footer={<>
          <button type="button" className="modal-button modal-button--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button type="button" className="modal-button btn-delete" onClick={() => remove(deleteTarget)}>Delete annotation</button>
        </>}
      >
        <p className="confirmation-copy">Permanently delete <strong>{deleteTarget?.label}</strong>?</p>
      </Modal>
    </div>
  );
}

function AnnotationForm({ title, values, onSubmit, onCancel, saving }) {
  return <form className="annotation-form" onSubmit={onSubmit}>
    <h4>{title}</h4>
    <label>Label<input name="label" required maxLength={120} defaultValue={values.label} autoFocus /></label>
    <label>Note<textarea name="note" maxLength={2000} defaultValue={values.note} rows={2} /></label>
    <label className="annotation-color">Color<input name="color" type="color" defaultValue={values.color} /></label>
    <div><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" className="btn-control-secondary" onClick={onCancel}>Cancel</button></div>
  </form>;
}
