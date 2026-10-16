import { useCallback, useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { Bookmark, Edit3, Eye, EyeOff, Expand, Layers, Maximize2, Minimize2, Minus, Plus, RefreshCw, RotateCcw, RotateCw, Trash2, PenTool } from 'lucide-react';
import '../SlideViewer/SlideViewer.css';
import './WsiViewer.css';
import { API_BASE_URL as API } from '../../config';
import Modal from '../Modal/Modal';
import { viewerService } from '../../services/viewerService';
import { getAnnotationHoverMeasurements, getAnnotationMeasurements } from './annotationMeasurements';
import { useAuth } from '../../modules/auth/AuthProvider';
import { SYSTEM_ADMIN_ROLE, SUPER_ADMIN_ROLE } from '../../config/roles';

const DISPLAY_PROFILES = {
  standard: ['Standard color', 'Original RGB display without a profile transformation.'],
  grayscale: ['Grayscale', 'Removes hue to emphasize luminance and tissue structure.'],
  inverted: ['Inverted', 'Reverses displayed colors for alternate visual inspection.'],
  'high-contrast': ['High contrast', 'Expands tonal separation in the displayed image.'],
  'low-saturation': ['Low saturation', 'Reduces stain intensity while retaining limited color.'],
  'high-saturation': ['Enhanced saturation', 'Increases displayed color separation.'],
  'red-channel': ['Red channel', 'Displays only the source image red channel.'],
  'green-channel': ['Green channel', 'Displays only the source image green channel.'],
  'blue-channel': ['Blue channel', 'Displays only the source image blue channel.'],
  'hue-positive': ['Hue shift +90°', 'Rotates displayed hue for visual separation experiments.'],
  'hue-negative': ['Hue shift −90°', 'Rotates displayed hue in the opposite direction.'],
};

function normalizeDraftForMeasurement(geometry) {
  if (!geometry) return null;
  const type = geometry.type;
  if (['rectangle', 'ellipse'].includes(type) && geometry.points?.length >= 2) {
    const [first, second] = geometry.points;
    return { annotation_type: type, width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) };
  }
  const points = [...(geometry.points || []), ...(type === 'polygon' && geometry.cursor ? [geometry.cursor] : [])].map((point) => [point.x, point.y]);
  return { annotation_type: type, points };
}

function niceScaleMicrons(value) {
  if (!(value > 0)) return null;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const factor = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  return factor * power;
}

function scaleLabel(microns) {
  if (microns >= 1000) return `${Number((microns / 1000).toPrecision(3))} mm`;
  return `${Number(microns.toPrecision(3))} µm`;
}

export default function WsiViewer({ slide, onError, syncViews, syncedViewerRef, externalViewerRef }) {
  const { user } = useAuth();
  const elementRef = useRef(null);
  const workspaceRef = useRef(null);
  const viewerRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(true);
  const [drawMode, setDrawMode] = useState(null); // 'rectangle', 'polygon', 'arrow', or null
  const [visible, setVisible] = useState(true);
  const [draft, setDraft] = useState(null);
  const [redoDraft, setRedoDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [validation, setValidation] = useState(null);
  const [aiResults, setAiResults] = useState([]);
  const [aiVisible, setAiVisible] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [displayProfile, setDisplayProfile] = useState('standard');
  const [loadFailure, setLoadFailure] = useState('');
  const preferencesSlideRef = useRef(null);
  const svgOverlayRef = useRef(null);
  const lastTileErrorToastTime = useRef(0);
  
  // For rendering SVG aligned with OpenSeadragon
  const [, setViewState] = useState({ zoom: 1, pan: {x: 0, y: 0} });
  const [draftGeometry, setDraftGeometry] = useState(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [calibrationSaving, setCalibrationSaving] = useState(false);
  const [annotationCategory, setAnnotationCategory] = useState('All');
  const [annotationStatus, setAnnotationStatus] = useState('All');
  const [scaleBar, setScaleBar] = useState(null);
  const [resizeState, setResizeState] = useState(null);

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
      const data = await viewerService.annotations(slide.id, signal);
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
    const controller = new AbortController();
    Promise.all([
      viewerService.validation(slide.id, controller.signal).catch(() => null),
      viewerService.bookmarks(slide.id, controller.signal).catch(() => []),
      viewerService.aiResults(slide.id, controller.signal).catch(() => []),
      viewerService.preferences(slide.id, controller.signal).catch(() => ({ display_profile: 'standard', brightness: 100, contrast: 100 })),
    ]).then(([metadata, saved, results, preferences]) => {
      if (!controller.signal.aborted) {
        setValidation(metadata); setBookmarks(saved); setAiResults(results);
        setDisplayProfile(preferences.display_profile); setBrightness(preferences.brightness); setContrast(preferences.contrast);
        preferencesSlideRef.current = slide.id;
      }
    });
    return () => controller.abort();
  }, [slide.id]);

  useEffect(() => {
    if (preferencesSlideRef.current !== slide.id) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      viewerService.savePreferences(slide.id, {
        display_profile: displayProfile, brightness, contrast,
      }, controller.signal).catch((error) => {
        if (error.name !== 'AbortError') onError(`Could not save display metadata: ${error.message}`);
      });
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [brightness, contrast, displayProfile, onError, slide.id]);

  useEffect(() => {
    let dziUrl = slide.dzi_url;
    if (dziUrl && dziUrl.startsWith('/') && API) {
      dziUrl = `${API}${dziUrl}`;
    }

    const viewer = OpenSeadragon({
      element: elementRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      showNavigator: true,
      navigatorPosition: 'BOTTOM_RIGHT',
      animationTime: 0.7,
      blendTime: 0.1,
      constrainDuringPan: true,
      visibilityRatio: 0.5,
      minZoomImageRatio: 0.8,
      maxZoomPixelRatio: 2,
      crossOriginPolicy: 'Anonymous',
      ajaxWithCredentials: true,
      timeout: 60000,
      imageLoaderLimit: 6,
    });
    viewerRef.current = viewer;
    
    viewer.addHandler('open', () => { setViewerReady(true); setLoadFailure(''); });
    viewer.addHandler('open-failed', (event) => setLoadFailure(event.message || 'The slide descriptor could not be loaded.'));
    viewer.addHandler('tile-load-failed', (event) => {
      const now = Date.now();
      if (now - lastTileErrorToastTime.current > 6000) {
        lastTileErrorToastTime.current = now;
        setLoadFailure(`A high-resolution tile failed to load${event.message ? `: ${event.message}` : ''}`);
      }
    });
    
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
    const viewer = viewerRef.current;
    const micronX = Number(validation?.physical_calibration?.pixel_size_microns_x);
    if (!viewerReady || !viewer?.viewport || !(micronX > 0)) {
      setScaleBar(null);
      return undefined;
    }
    const updateScaleBar = () => {
      const item = viewer.world?.getItemAt(0);
      if (!item) return;
      const start = item.viewportToImageCoordinates(viewer.viewport.pointFromPixel(new OpenSeadragon.Point(0, 0), true));
      const end = item.viewportToImageCoordinates(viewer.viewport.pointFromPixel(new OpenSeadragon.Point(100, 0), true));
      const micronsPerScreenPixel = Math.abs(end.x - start.x) * micronX / 100;
      const physicalWidth = niceScaleMicrons(micronsPerScreenPixel * 110);
      if (physicalWidth) setScaleBar({ width: Math.max(35, Math.min(150, physicalWidth / micronsPerScreenPixel)), label: scaleLabel(physicalWidth) });
    };
    updateScaleBar();
    viewer.addHandler('update-viewport', updateScaleBar);
    viewer.addHandler('animation-finish', updateScaleBar);
    return () => {
      viewer.removeHandler('update-viewport', updateScaleBar);
      viewer.removeHandler('animation-finish', updateScaleBar);
    };
  }, [validation, viewerReady]);

  useEffect(() => {
    if (externalViewerRef) {
      externalViewerRef.current = viewerRef.current;
    }
  }, [viewerReady, externalViewerRef]);

  useEffect(() => {
    const targetRefs = Array.isArray(syncedViewerRef) ? syncedViewerRef : [syncedViewerRef];
    if (!syncViews || !viewerReady || !viewerRef.current || !targetRefs.some((targetRef) => targetRef?.current)) return;
    const v1 = viewerRef.current;
    
    const handler = () => {
      if (v1.isSyncing) return;
      const item1 = v1.world?.getItemAt(0);
      if (!item1) return;
      const center1 = v1.viewport.getCenter();
      const size1 = item1.getContentSize();
      const fracX = center1.x;
      const fracY = size1.x ? center1.y / (size1.y / size1.x) : 0;
      targetRefs.forEach((targetRef) => {
        const v2 = targetRef?.current;
        const item2 = v2?.world?.getItemAt(0);
        if (!v2 || !item2) return;
        v2.isSyncing = true;
        const size2 = item2.getContentSize();
        const targetY = size2.x ? fracY * (size2.y / size2.x) : 0;
        v2.viewport.zoomTo(v1.viewport.getZoom(), null, true);
        v2.viewport.panTo(new OpenSeadragon.Point(fracX, targetY), true);
        v2.viewport.setRotation(v1.viewport.getRotation(), true);
        setTimeout(() => { v2.isSyncing = false; }, 50);
      });
    };

    v1.addHandler('pan', handler);
    v1.addHandler('zoom', handler);
    v1.addHandler('rotate', handler);

    return () => {
      v1.removeHandler('pan', handler);
      v1.removeHandler('zoom', handler);
      v1.removeHandler('rotate', handler);
    };
  }, [syncViews, viewerReady, syncedViewerRef]);

  // SVG coordinate conversions
  const imageToViewport = useCallback((x, y) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.world.getItemAt(0)) return {x:0, y:0};
    const vp = viewer.world.getItemAt(0).imageToViewportCoordinates(x, y);
    const pixel = viewer.viewport.pixelFromPoint(vp, true);
    return { x: pixel.x, y: pixel.y };
  }, []);

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
      if (drawMode === 'point') {
        setDraft({ annotation_type: 'point', points: [[pt.x, pt.y]], label: '', note: '', color: '#e85d75', category: 'Pathologist', annotation_status: 'Active' });
        setDrawMode(null);
      } else if (drawMode === 'polygon') {
        if (!drawingState) {
          drawingState = { type: 'polygon', points: [pt] };
        } else {
          drawingState.points.push(pt);
        }
        setDraftGeometry({ ...drawingState, cursor: pt });
      } else if (drawMode === 'freehand') {
        drawingState = { type: 'freehand', points: [pt] };
        setDraftGeometry({ ...drawingState });
      } else if (['rectangle', 'ellipse', 'arrow', 'line'].includes(drawMode)) {
        drawingState = { type: drawMode, points: [pt, pt] };
        setDraftGeometry({ ...drawingState });
      }
    };

    const move = (event) => {
      if (!drawingState || !drawMode) return;
      const pt = getImagePoint(event);
      
      if (drawMode === 'polygon') {
        setDraftGeometry({ ...drawingState, cursor: pt });
      } else if (drawMode === 'freehand') {
        drawingState.points.push(pt);
        setDraftGeometry({ ...drawingState, points: [...drawingState.points] });
      } else if (['rectangle', 'ellipse', 'arrow', 'line'].includes(drawMode)) {
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
      if (drawMode !== 'freehand') drawingState.points[1] = pt;
      
      // Complete rectangle or arrow
      const [p1, p2] = drawingState.points;
      
      let finalGeom = null;
      if (drawMode === 'rectangle' || drawMode === 'ellipse') {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        if (w >= 1 && h >= 1) {
           finalGeom = { annotation_type: drawMode, x, y, width: w, height: h };
        }
      } else if (drawMode === 'arrow' || drawMode === 'line') {
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        if (dx >= 1 || dy >= 1) {
           finalGeom = { annotation_type: drawMode, points: [[p1.x, p1.y], [p2.x, p2.y]] };
        }
      } else if (drawMode === 'freehand' && drawingState.points.length >= 2) {
        finalGeom = { annotation_type: 'freehand', points: drawingState.points.map((point) => [point.x, point.y]) };
      }
      
      if (finalGeom) {
        setDraft({ ...finalGeom, label: '', note: '', color: '#e85d75', category: 'Pathologist', annotation_status: 'Active' });
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
         setDraft({ annotation_type: 'polygon', points: finalPts, label: '', note: '', color: '#e85d75', category: 'Pathologist', annotation_status: 'Active' });
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
  const zoomBy = (factor) => viewerRef.current?.viewport.zoomBy(factor);
  const rotateBy = (degrees) => viewerRef.current?.viewport.setRotation(viewerRef.current.viewport.getRotation() + degrees);
  const retrySlide = () => { setLoadFailure(''); viewerRef.current?.open(slide.dzi_url?.startsWith('/') && API ? `${API}${slide.dzi_url}` : slide.dzi_url); };
  const saveBookmark = async () => {
    const viewport = viewerRef.current?.viewport;
    if (!viewport) return;
    const bounds = viewport.getBounds(true);
    const name = `Region ${bookmarks.length + 1}`;
    try {
      const saved = await viewerService.createBookmark(slide.id, {
        name, viewport_x: bounds.x, viewport_y: bounds.y, viewport_width: bounds.width,
        viewport_height: bounds.height, rotation: viewport.getRotation(),
      });
      setBookmarks((current) => [saved, ...current]);
    } catch (error) { onError(`Could not save region: ${error.message}`); }
  };
  const openBookmark = (bookmark) => {
    const viewport = viewerRef.current?.viewport;
    if (!viewport) return;
    viewport.setRotation(bookmark.rotation || 0, true);
    viewport.fitBounds(new OpenSeadragon.Rect(bookmark.viewport_x, bookmark.viewport_y, bookmark.viewport_width, bookmark.viewport_height), true);
  };
  const removeBookmark = async (bookmark) => {
    try {
      await viewerService.deleteBookmark(slide.id, bookmark.id);
      setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
    } catch (error) { onError(`Could not delete saved region: ${error.message}`); }
  };

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!draft && !editing) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [draft, editing]);

  useEffect(() => {
    const keydown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && draft) { event.preventDefault(); setRedoDraft(draft); setDraft(null); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && redoDraft) { event.preventDefault(); setDraft(redoDraft); setRedoDraft(null); return; }
      const actions = {
        '+': () => zoomBy(1.25), '=': () => zoomBy(1.25), '-': () => zoomBy(0.8),
        '0': reset, 'f': fit, 'r': () => rotateBy(90), 'b': saveBookmark,
      };
      const action = actions[event.key.toLowerCase()];
      if (action) { event.preventDefault(); action(); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
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
      const data = await viewerService.createAnnotation(slide.id, { ...draft, ...details });
      setAnnotations((current) => [...current, data]);
      setDraft(null);
    } catch (error) { onError(`Could not save annotation: ${error.message}`); }
    finally { setSaving(false); }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const details = Object.fromEntries(new FormData(event.currentTarget));
      const data = await viewerService.updateAnnotation(slide.id, editing.id, {
        ...details,
        x: editing.x, y: editing.y, width: editing.width, height: editing.height, points: editing.points,
      });
      setAnnotations((current) => current.map((item) => item.id === data.id ? data : item));
      setEditing(null);
    } catch (error) { onError(`Could not update annotation: ${error.message}`); }
    finally { setSaving(false); }
  }

  async function remove(annotation) {
    try {
      await viewerService.deleteAnnotation(slide.id, annotation.id);
      setAnnotations((current) => current.filter((item) => item.id !== annotation.id));
      if (editing?.id === annotation.id) setEditing(null);
      setDeleteTarget(null);
    } catch (error) { onError(`Could not delete annotation: ${error.message}`); }
  }

  const renderShape = (geom, color, isDraft) => {
    if (geom.annotation_type === 'point' || geom.type === 'point') {
       const point = isDraft ? geom.points[0] : { x: geom.points[0][0], y: geom.points[0][1] };
       const pixel = imageToViewport(point.x, point.y);
       return <circle cx={pixel.x} cy={pixel.y} r="6" fill={color} stroke="var(--text-inverse)" strokeWidth="2" />;
    } else if (['rectangle', 'ellipse'].includes(geom.annotation_type || geom.type)) {
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
       if ((geom.annotation_type || geom.type) === 'ellipse') return <ellipse cx={(p1.x + p2.x) / 2} cy={(p1.y + p2.y) / 2} rx={Math.abs(p2.x - p1.x) / 2} ry={Math.abs(p2.y - p1.y) / 2} fill={`${color}33`} stroke={color} strokeWidth="2" />;
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
    } else if (['line', 'freehand'].includes(geom.annotation_type || geom.type)) {
       const pts = geom.points.map((point) => isDraft ? imageToViewport(point.x, point.y) : imageToViewport(point[0], point[1]));
       return <polyline points={pts.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />;
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

  const imagePointFromPointer = (event) => {
    const viewer = viewerRef.current;
    const host = svgOverlayRef.current;
    const item = viewer?.world?.getItemAt(0);
    if (!viewer?.viewport || !host || !item) return null;
    const bounds = host.getBoundingClientRect();
    const viewportPoint = viewer.viewport.pointFromPixel(new OpenSeadragon.Point(event.clientX - bounds.left, event.clientY - bounds.top));
    const point = item.viewportToImageCoordinates(viewportPoint);
    return { x: Math.max(0, Math.min(slide.width, point.x)), y: Math.max(0, Math.min(slide.height, point.y)) };
  };

  const beginResize = (event, corner) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setResizeState({ corner });
    viewerRef.current?.setMouseNavEnabled(false);
  };

  const resizeAnnotation = (event) => {
    if (!resizeState || !editing) return;
    const point = imagePointFromPointer(event);
    if (!point) return;
    const right = editing.x + editing.width;
    const bottom = editing.y + editing.height;
    const nextX = resizeState.corner.includes('w') ? Math.min(point.x, right - 1) : editing.x;
    const nextY = resizeState.corner.includes('n') ? Math.min(point.y, bottom - 1) : editing.y;
    const nextRight = resizeState.corner.includes('e') ? Math.max(point.x, editing.x + 1) : right;
    const nextBottom = resizeState.corner.includes('s') ? Math.max(point.y, editing.y + 1) : bottom;
    setEditing((current) => ({ ...current, x: nextX, y: nextY, width: nextRight - nextX, height: nextBottom - nextY }));
  };

  const finishResize = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setResizeState(null);
    viewerRef.current?.setMouseNavEnabled(!drawMode);
  };

  const renderResizeHandles = () => {
    if (!editing || !['rectangle', 'ellipse'].includes(editing.annotation_type)) return null;
    const corners = [
      ['nw', editing.x, editing.y], ['ne', editing.x + editing.width, editing.y],
      ['sw', editing.x, editing.y + editing.height], ['se', editing.x + editing.width, editing.y + editing.height],
    ];
    return corners.map(([corner, x, y]) => {
      const point = imageToViewport(x, y);
      return <circle key={corner} className={`annotation-resize-handle annotation-resize-handle--${corner}`} cx={point.x} cy={point.y} r="6" onPointerDown={(event) => beginResize(event, corner)} onPointerMove={resizeAnnotation} onPointerUp={finishResize} onPointerCancel={finishResize} />;
    });
  };

  const calibration = validation?.physical_calibration;
  const pixelSize = calibration?.available ? calibration.pixel_size_microns_x : null;
  const magnification = validation?.normalized_metadata?.magnification;
  const measurementLabel = (annotation) => pixelSize && annotation.annotation_type === 'rectangle'
    ? `${(annotation.width * pixelSize).toFixed(1)} × ${(annotation.height * pixelSize).toFixed(1)} µm`
    : null;
  const activeProfile = DISPLAY_PROFILES[displayProfile] || DISPLAY_PROFILES.standard;
  const showAnnotationMeasurement = (annotation) => setHoveredAnnotation(annotation);
  const aiMeasurementTarget = (result) => ({
    ...result.geometry,
    annotation_type: result.geometry.annotation_type || result.geometry.type?.toLowerCase(),
    label: `${result.model_name} ${result.model_version}`,
    measurementSource: 'AI-generated region',
  });
  const resetDisplay = () => { setDisplayProfile('standard'); setBrightness(100); setContrast(100); };
  const autoBalanceDisplay = () => { setDisplayProfile('standard'); setBrightness(105); setContrast(110); };
  const canCalibrate = ['Histotechnologist', SYSTEM_ADMIN_ROLE, SUPER_ADMIN_ROLE].includes(user?.role);
  const annotationCategories = [...new Set(annotations.map((annotation) => annotation.category).filter(Boolean))].sort();
  const annotationStatuses = [...new Set(annotations.map((annotation) => annotation.annotation_status).filter(Boolean))].sort();
  const filteredAnnotations = annotations.filter((annotation) => (annotationCategory === 'All' || annotation.category === annotationCategory) && (annotationStatus === 'All' || annotation.annotation_status === annotationStatus));
  const liveMeasurements = getAnnotationMeasurements(normalizeDraftForMeasurement(draftGeometry), calibration);
  const saveCalibration = async (event) => {
    event.preventDefault();
    if (calibrationSaving) return;
    const form = event.currentTarget;
    setCalibrationSaving(true);
    try {
      const updated = await viewerService.saveCalibration(slide.id, {
        pixel_size_microns_x: Number(form.elements.pixel_size_microns_x.value),
        pixel_size_microns_y: Number(form.elements.pixel_size_microns_y.value),
        reason: form.elements.reason.value,
      });
      setValidation(updated);
    } catch (error) {
      onError(`Could not save slide calibration: ${error.message}`);
    } finally {
      setCalibrationSaving(false);
    }
  };

  return (
    <div className="wsi-annotation-workspace" ref={workspaceRef}>
      <svg className="viewer-filter-definitions" aria-hidden="true">
        <defs>
          <filter id="wsi-red-channel" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
          <filter id="wsi-green-channel" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
          <filter id="wsi-blue-channel" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
        </defs>
      </svg>
      <div className="viewer-canvas-container">
        <div className="viewer-hint-bar">
          <span>{drawMode ? `Drawing ${drawMode}. ESC to cancel.` : 'Scroll to zoom • Drag to pan'}</span>
          <div className="wsi-controls">
            <label className={`annotation-tool-menu ${drawMode ? 'annotation-tool-menu--active' : ''}`}>
              <PenTool size={15} aria-hidden="true" />
              <span className="sr-only">Annotation tool</span>
              <select value={drawMode || ''} onChange={(event) => setDrawMode(event.target.value || null)} aria-label="Select annotation tool">
                <option value="">Annotation tools</option>
                <option value="point">Point marker</option>
                <option value="line">Line measurement</option>
                <option value="rectangle">Rectangle region</option>
                <option value="ellipse">Circle / ellipse region</option>
                <option value="polygon">Polygon region</option>
                <option value="arrow">Arrow marker</option>
                <option value="freehand">Freehand region</option>
              </select>
            </label>
            <div className="v-divider" aria-hidden="true" />
            <button type="button" className="btn-control-secondary viewer-icon-button" onClick={() => zoomBy(1.25)} title="Zoom in (+)" aria-label="Zoom in"><Plus size={15} /></button>
            <button type="button" className="btn-control-secondary viewer-icon-button" onClick={() => zoomBy(0.8)} title="Zoom out (-)" aria-label="Zoom out"><Minus size={15} /></button>
            <button type="button" className="btn-control-secondary viewer-icon-button" onClick={() => rotateBy(90)} title="Rotate clockwise (R)" aria-label="Rotate clockwise"><RotateCw size={15} /></button>
            <button type="button" className="btn-control-secondary" onClick={saveBookmark} title="Save current region (B)" aria-label="Save current region"><Bookmark size={15} /><span className="viewer-control-label">Save region</span></button>
            <div className="v-divider" aria-hidden="true" />
            <button type="button" className="btn-control-secondary" aria-pressed={!visible} onClick={() => setVisible((value) => !value)}>
              {visible ? <EyeOff size={15} /> : <Eye size={15} />} <span className="viewer-control-label">{visible ? 'Hide' : 'Show'}</span>
            </button>
            <button type="button" className="btn-control-secondary" onClick={fit} aria-label="Fit slide to screen"><Maximize2 size={15} /><span className="viewer-control-label">Fit</span></button>
            <button type="button" className="btn-control-secondary" onClick={reset} aria-label="Reset slide view"><RotateCcw size={15} /><span className="viewer-control-label">Reset</span></button>
            <button type="button" className="btn-control-secondary" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Open fullscreen'}>
              {fullscreen ? <Minimize2 size={15} /> : <Expand size={15} />} <span className="viewer-control-label">{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
            </button>
          </div>
        </div>
        
        <div className={`wsi-stage display-${displayProfile}`} data-brightness={brightness} data-contrast={contrast}>
          <div className={`wsi-viewer ${drawMode ? 'drawing-mode' : ''}`} ref={elementRef} aria-label={`Whole-slide viewer for ${slide.label}`} />
          
          <svg ref={svgOverlayRef} className={`annotation-svg-overlay ${drawMode ? 'drawing-active' : ''}`}>
             <defs>
               <marker id="arrowhead-draft" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                 <polygon points="0 0, 10 3.5, 0 7" fill="#e85d75" />
               </marker>
               {visible && filteredAnnotations.map(a => (
                 <marker key={`marker-${a.id}`} id={`arrowhead-${a.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                   <polygon points="0 0, 10 3.5, 0 7" fill={a.color} />
                 </marker>
               ))}
             </defs>
             {visible && filteredAnnotations.map((annotation) => (
                <g key={annotation.id} className="annotation-shape" onClick={() => goTo(annotation)} onPointerEnter={() => showAnnotationMeasurement({ ...annotation, measurementSource: 'Human annotation' })} onPointerLeave={() => setHoveredAnnotation(null)}>
                   <title>{annotation.label}</title>
                   {renderShape(editing?.id === annotation.id ? editing : annotation, annotation.color, false)}
                </g>
             ))}
             {renderResizeHandles()}
             {aiVisible && aiResults.map((result) => result.geometry && <g key={`ai-${result.id}`} className="ai-result-shape" onPointerEnter={() => showAnnotationMeasurement(aiMeasurementTarget(result))} onPointerLeave={() => setHoveredAnnotation(null)}><title>{`${result.model_name} ${result.model_version}${result.confidence == null ? '' : ` · ${(result.confidence * 100).toFixed(1)}%`}`}</title>{renderShape({ ...result.geometry, id: `ai-${result.id}` }, '#d39a3c', false)}</g>)}
             {draftGeometry && renderShape(draftGeometry, '#e85d75', true)}
          </svg>
          {hoveredAnnotation && <div className="annotation-hover-measurement" role="tooltip">
            <header><strong>{hoveredAnnotation.label || 'Selected region'}</strong><span>{hoveredAnnotation.measurementSource}</span></header>
            {getAnnotationHoverMeasurements(hoveredAnnotation, calibration).map((measurement) => <div key={measurement.label}>
              <span>{measurement.label}</span>
              <output>{measurement.metric}</output>
              {measurement.imperial && <output>{measurement.imperial}</output>}
            </div>)}
          </div>}
          {draftGeometry && liveMeasurements.length > 0 && <div className="annotation-live-measurement" role="status">
            <strong>Live measurement</strong>
            {liveMeasurements.map((measurement) => <span key={measurement.label}>{measurement.label}: {measurement.value}</span>)}
          </div>}
          {scaleBar && <div className="viewer-scale-bar" aria-label={`Image scale ${scaleBar.label}`}>
            <span>{scaleBar.label}</span><svg width={scaleBar.width} height="8" aria-hidden="true"><path d={`M 1 1 V 7 M 1 6 H ${scaleBar.width - 1} M ${scaleBar.width - 1} 1 V 7`} /></svg>
          </div>}
        </div>
        
        {!viewerReady && !loadFailure && <div className="viewer-loading"><span className="loading-spinner" /> Loading low-resolution preview and slide tiles…</div>}
        {loadFailure && <div className="viewer-load-error" role="alert"><strong>Slide loading degraded</strong><span>{loadFailure} Your annotations remain saved.</span><button type="button" className="btn-control-secondary" onClick={retrySlide}><RefreshCw size={15} /> Retry</button></div>}
        <div className="viewer-status-strip"><span>{magnification ? `${magnification}× source` : 'Magnification unavailable'}</span><span>{pixelSize ? `${pixelSize.toFixed(4)} µm/px calibrated` : 'Physical scale unavailable — pixel measurements only'}</span><span>{validation?.level_count || slide.level_count || 1} pyramid levels</span></div>
      </div>

      <aside className="annotation-panel">
        {!calibration?.available && <section className="viewer-calibration" aria-label="Physical calibration">
          <div><h3>Physical size calibration</h3><p>Required to display actual tumor size.</p></div>
          {canCalibrate ? <form onSubmit={saveCalibration}>
            <label>Horizontal µm/px<input name="pixel_size_microns_x" type="number" min="0.0001" max="1000" step="any" required placeholder="Example: 0.25" /></label>
            <label>Vertical µm/px<input name="pixel_size_microns_y" type="number" min="0.0001" max="1000" step="any" required placeholder="Example: 0.25" /></label>
            <label>Calibration source / reason<input name="reason" required minLength="3" maxLength="2000" placeholder="Scanner specification or stage micrometer" /></label>
            <button className="btn-primary" disabled={calibrationSaving}>{calibrationSaving ? 'Saving…' : 'Apply calibration'}</button>
          </form> : <p className="viewer-calibration-notice">Ask a Histotechnologist or administrator to enter the scanner’s verified µm/px value.</p>}
        </section>}
        <div className="annotation-panel-heading"><div><h3>Annotations</h3><span>{annotations.length} items</span></div></div>
        <section className="annotation-layer-controls" aria-label="Annotation layers and filters">
          <header><Layers size={15} /><strong>Annotation layers</strong></header>
          <label><span>Human annotations</span><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /></label>
          <label><span>Category</span><select value={annotationCategory} onChange={(event) => setAnnotationCategory(event.target.value)}><option>All</option>{annotationCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label><span>Status</span><select value={annotationStatus} onChange={(event) => setAnnotationStatus(event.target.value)}><option>All</option>{annotationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <small>{filteredAnnotations.length} of {annotations.length} human annotations visible</small>
        </section>
        <section className="viewer-display-controls" aria-label="Display controls">
          <div className="viewer-display-heading"><div><Layers size={16} /><h4>Display layers</h4></div><div className="viewer-display-actions"><button type="button" className="btn-control-secondary" onClick={autoBalanceDisplay}>Auto balance</button><button type="button" className="btn-control-secondary" onClick={resetDisplay}>Reset</button></div></div>
          <label>Profile<select value={displayProfile} onChange={(event) => setDisplayProfile(event.target.value)}><optgroup label="Tonal"><option value="standard">Standard color</option><option value="grayscale">Grayscale</option><option value="inverted">Inverted</option><option value="high-contrast">High contrast</option><option value="low-saturation">Low saturation</option><option value="high-saturation">Enhanced saturation</option></optgroup><optgroup label="Source channels"><option value="red-channel">Red channel</option><option value="green-channel">Green channel</option><option value="blue-channel">Blue channel</option></optgroup><optgroup label="Experimental hue"><option value="hue-positive">Hue shift +90°</option><option value="hue-negative">Hue shift −90°</option></optgroup></select></label>
          <label className="viewer-range-control"><span>Brightness <output>{brightness}%</output></span><input type="range" min="50" max="150" step="5" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} aria-label="Brightness percentage" /></label>
          <label className="viewer-range-control"><span>Contrast <output>{contrast}%</output></span><input type="range" min="50" max="150" step="5" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} aria-label="Contrast percentage" /></label>
          <div className="viewer-profile-description"><strong>{activeProfile[0]}</strong><span>{activeProfile[1]}</span></div>
          <p>Auto balance is a neutral viewing preset, not image analysis. Display-only aids do not modify the stored image and are not validated diagnostic transformations.</p>
        </section>
        <section className="viewer-bookmarks" aria-label="Saved regions">
          <div className="annotation-panel-heading"><div><h3>Saved regions</h3><span>{bookmarks.length} items</span></div></div>
          {!bookmarks.length ? <p className="annotation-empty">No saved regions.</p> : bookmarks.map((bookmark) => <div className="viewer-bookmark" key={bookmark.id}><button type="button" onClick={() => openBookmark(bookmark)}>{bookmark.name}</button><button type="button" aria-label={`Delete ${bookmark.name}`} onClick={() => removeBookmark(bookmark)}><Trash2 size={13} /></button></div>)}
        </section>
        {aiResults.length > 0 && <section className="viewer-ai-results" aria-label="AI evidence"><div className="annotation-panel-heading"><div><h3>AI evidence</h3><span>{aiResults.length} results</span></div><button type="button" className="btn-control-secondary" onClick={() => setAiVisible((value) => !value)}>{aiVisible ? 'Hide' : 'Show'}</button></div>{aiResults.map((result) => <div className="viewer-ai-result" key={result.id}><strong>{result.model_name} {result.model_version}</strong><span>{result.result_type} · {result.confidence == null ? 'No confidence' : `${(result.confidence * 100).toFixed(1)}% confidence`}</span>{result.limitations && <small>{result.limitations}</small>}</div>)}</section>}
        {draft && <AnnotationForm title="New annotation" values={draft} calibration={calibration} onSubmit={saveNew} onCancel={() => setDraft(null)} saving={saving} />}
        {editing && <AnnotationForm title="Edit annotation" values={editing} calibration={calibration} onSubmit={saveEdit} onCancel={() => setEditing(null)} saving={saving} />}
        {annotationsLoading ? <p className="annotation-empty">Loading annotations…</p> : !annotations.length ?
          <p className="annotation-empty">No annotations yet. Choose a tool to mark a region.</p> :
          <div className="annotation-list">{filteredAnnotations.map((annotation) => <div className="annotation-item" key={annotation.id}>
            <button type="button" className="annotation-open" onClick={() => goTo(annotation)}>
              <span className="annotation-swatch"><svg aria-hidden="true" viewBox="0 0 8 24"><rect width="8" height="24" rx="3" fill={annotation.color} /></svg></span>
              <span><strong>{annotation.label}</strong><small>{annotation.note || 'No note'}</small>{measurementLabel(annotation) && <small>{measurementLabel(annotation)}</small>}</span>
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

function AnnotationForm({ title, values, calibration, onSubmit, onCancel, saving }) {
  const measurements = getAnnotationMeasurements(values, calibration);
  return <form className="annotation-form" onSubmit={onSubmit}>
    <h4>{title}</h4>
    <label>Label<input name="label" required maxLength={120} defaultValue={values.label} autoFocus /></label>
    <label>Note<textarea name="note" maxLength={2000} defaultValue={values.note} rows={2} /></label>
    <label>Category<select name="category" defaultValue={values.category || 'Pathologist'}><option>Pathologist</option><option>QC</option><option>Research</option><option>Imported</option><option>AI correction</option></select></label>
    <label>Status<select name="annotation_status" defaultValue={values.annotation_status || 'Active'}><option>Active</option><option>Resolved</option><option>Excluded</option><option>Corrected</option></select></label>
    <section className="annotation-measurements" aria-label="Automatic physical measurements">
      <header><strong>Automatic measurement</strong><span>Read-only</span></header>
      {measurements.map((measurement) => <div key={measurement.label}><span>{measurement.label}</span><output>{measurement.value}</output></div>)}
    </section>
    {values.id && <label>Change reason<input name="change_reason" required maxLength={2000} defaultValue="Annotation corrected" /></label>}
    <label className="annotation-color">Color<input name="color" type="color" defaultValue={values.color} /></label>
    <div><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" className="btn-control-secondary" onClick={onCancel}>Cancel</button></div>
  </form>;
}
