import { useState, useEffect, useRef, useCallback } from 'react';
import OpenSeadragon from 'openseadragon';
import {
  Layers, Plus, Trash2, CheckCircle, RefreshCw, X, Play, RotateCcw,
  Sparkles, History, Save, ShieldAlert, Crosshair, HelpCircle
} from 'lucide-react';
import LandmarkEditor from './LandmarkEditor';
import RegistrationQuality from './RegistrationQuality';
import RegisteredComparison from './RegisteredComparison';
import { registrationService } from '../../services/registrationService';
import { API_BASE_URL as API } from '../../config';
import './RegistrationWorkspace.css';

export default function RegistrationWorkspace({
  currentCase,
  initialRefSlideId = null,
  initialMovingSlideId = null,
  onClose,
  onError,
}) {
  const slides = currentCase?.slides || [];

  // Slide Selection
  const [refSlideId, setRefSlideId] = useState(initialRefSlideId || slides[0]?.id || null);
  const [movingSlideId, setMovingSlideId] = useState(
    initialMovingSlideId || slides.find((s) => s.id !== (initialRefSlideId || slides[0]?.id))?.id || null
  );

  const refSlide = slides.find((s) => s.id === Number(refSlideId)) || null;
  const movingSlide = slides.find((s) => s.id === Number(movingSlideId)) || null;

  // Registration State
  const [activeRegistration, setActiveRegistration] = useState(null);
  const [transformType, setTransformType] = useState('affine');
  const [landmarks, setLandmarks] = useState([]); // [{ id, ref_x, ref_y, mov_x, mov_y }]
  const [activeLandmarkId, setActiveLandmarkId] = useState(null);
  const [previewMode, setPreviewMode] = useState('landmarks'); // 'landmarks' | 'comparison'
  const [compSubMode, setCompSubMode] = useState('side-by-side'); // 'side-by-side' | 'overlay' | 'swipe'
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  // Dual OpenSeadragon viewers for landmark placement
  const refViewerContainerRef = useRef(null);
  const movViewerContainerRef = useRef(null);
  const refViewerRef = useRef(null);
  const movViewerRef = useRef(null);
  const [viewersReady, setViewersReady] = useState(false);
  const [, setViewportTick] = useState(0);

  // Load or initialize registration record
  useEffect(() => {
    if (!currentCase?.id || !refSlideId || !movingSlideId || refSlideId === movingSlideId) return;

    const controller = new AbortController();
    registrationService
      .list({ case_id: currentCase.id }, controller.signal)
      .then((regs) => {
        if (controller.signal.aborted) return;
        const existing = regs.find(
          (r) => r.reference_slide_id === Number(refSlideId) && r.moving_slide_id === Number(movingSlideId)
        );
        if (existing) {
          setActiveRegistration(existing);
          setTransformType(existing.transform_type || 'affine');
          setLandmarks(existing.landmarks_json || []);
        } else {
          setActiveRegistration(null);
          setLandmarks([]);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) onError?.(`Could not load registrations: ${err.message}`);
      });

    return () => controller.abort();
  }, [currentCase?.id, refSlideId, movingSlideId, onError]);

  // Initialize Reference Slide Viewer for landmark placement
  useEffect(() => {
    if (previewMode !== 'landmarks' || !refViewerContainerRef.current || !refSlide) return;
    let dziUrl = refSlide.dzi_url;
    if (dziUrl && dziUrl.startsWith('/') && API) dziUrl = `${API}${dziUrl}`;

    const viewer = OpenSeadragon({
      element: refViewerContainerRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      showNavigator: false,
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      crossOriginPolicy: 'Anonymous',
      ajaxWithCredentials: true,
    });
    refViewerRef.current = viewer;

    const updateView = () => setViewportTick((t) => t + 1);
    viewer.addHandler('update-viewport', updateView);
    viewer.addHandler('animation', updateView);
    viewer.addHandler('open', () => setViewersReady(true));

    return () => {
      refViewerRef.current = null;
      viewer.destroy();
    };
  }, [refSlide, previewMode]);

  // Initialize Moving Slide Viewer for landmark placement
  useEffect(() => {
    if (previewMode !== 'landmarks' || !movViewerContainerRef.current || !movingSlide) return;
    let dziUrl = movingSlide.dzi_url;
    if (dziUrl && dziUrl.startsWith('/') && API) dziUrl = `${API}${dziUrl}`;

    const viewer = OpenSeadragon({
      element: movViewerContainerRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      showNavigator: false,
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      crossOriginPolicy: 'Anonymous',
      ajaxWithCredentials: true,
    });
    movViewerRef.current = viewer;

    const updateView = () => setViewportTick((t) => t + 1);
    viewer.addHandler('update-viewport', updateView);
    viewer.addHandler('animation', updateView);

    return () => {
      movViewerRef.current = null;
      viewer.destroy();
    };
  }, [movingSlide, previewMode]);

  // Coordinate Conversion (Level-0 image to Viewport screen pixel)
  const imageToViewportRef = useCallback((x, y) => {
    const v = refViewerRef.current;
    if (!v?.world?.getItemAt(0)) return { x: 0, y: 0 };
    const vp = v.world.getItemAt(0).imageToViewportCoordinates(x, y);
    const pixel = v.viewport.pixelFromPoint(vp, true);
    return { x: pixel.x, y: pixel.y };
  }, []);

  const imageToViewportMov = useCallback((x, y) => {
    const v = movViewerRef.current;
    if (!v?.world?.getItemAt(0)) return { x: 0, y: 0 };
    const vp = v.world.getItemAt(0).imageToViewportCoordinates(x, y);
    const pixel = v.viewport.pixelFromPoint(vp, true);
    return { x: pixel.x, y: pixel.y };
  }, []);

  // Handle canvas click to place landmark point on Reference slide
  const handleRefCanvasClick = (e) => {
    const viewer = refViewerRef.current;
    if (!viewer?.world?.getItemAt(0)) return;
    const rect = refViewerContainerRef.current.getBoundingClientRect();
    const pixel = new OpenSeadragon.Point(e.clientX - rect.left, e.clientY - rect.top);
    const vp = viewer.viewport.pointFromPixel(pixel);
    const imgPt = viewer.world.getItemAt(0).viewportToImageCoordinates(vp);

    setLandmarks((prev) => {
      // If there's an incomplete active landmark without ref, fill it
      const activeIdx = prev.findIndex((lm) => lm.id === activeLandmarkId);
      if (activeIdx >= 0 && prev[activeIdx].ref_x == null) {
        const next = [...prev];
        next[activeIdx] = { ...next[activeIdx], ref_x: imgPt.x, ref_y: imgPt.y };
        return next;
      }
      // Otherwise create a new landmark pair with this reference point
      const newLm = {
        id: `lm_${Date.now()}`,
        ref_x: imgPt.x,
        ref_y: imgPt.y,
        mov_x: null,
        mov_y: null,
      };
      setActiveLandmarkId(newLm.id);
      return [...prev, newLm];
    });
  };

  // Handle canvas click to place landmark point on Moving slide
  const handleMovCanvasClick = (e) => {
    const viewer = movViewerRef.current;
    if (!viewer?.world?.getItemAt(0)) return;
    const rect = movViewerContainerRef.current.getBoundingClientRect();
    const pixel = new OpenSeadragon.Point(e.clientX - rect.left, e.clientY - rect.top);
    const vp = viewer.viewport.pointFromPixel(pixel);
    const imgPt = viewer.world.getItemAt(0).viewportToImageCoordinates(vp);

    setLandmarks((prev) => {
      // Find the landmark waiting for a moving point (either active or the latest one)
      let targetIdx = prev.findIndex((lm) => lm.id === activeLandmarkId);
      if (targetIdx < 0 || prev[targetIdx].mov_x != null) {
        targetIdx = prev.findIndex((lm) => lm.mov_x == null);
      }
      if (targetIdx >= 0) {
        const next = [...prev];
        next[targetIdx] = { ...next[targetIdx], mov_x: imgPt.x, mov_y: imgPt.y };
        setActiveLandmarkId(null);
        return next;
      }
      // Or create with moving point first
      const newLm = {
        id: `lm_${Date.now()}`,
        ref_x: null,
        ref_y: null,
        mov_x: imgPt.x,
        mov_y: imgPt.y,
      };
      setActiveLandmarkId(newLm.id);
      return [...prev, newLm];
    });
  };

  // Delete / Clear landmarks
  const handleDeleteLandmark = (lmId) => {
    setLandmarks((prev) => prev.filter((lm) => lm.id !== lmId));
    if (activeLandmarkId === lmId) setActiveLandmarkId(null);
  };

  const handleClearLandmarks = () => {
    setLandmarks([]);
    setActiveLandmarkId(null);
  };

  // Calculate alignment transformation
  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      let reg = activeRegistration;
      if (!reg) {
        reg = await registrationService.create({
          case_id: currentCase.id,
          reference_slide_id: Number(refSlideId),
          moving_slide_id: Number(movingSlideId),
          registration_method: 'manual',
          transform_type: transformType,
        });
        setActiveRegistration(reg);
      }

      // Save current landmarks
      await registrationService.saveLandmarks(reg.id, landmarks);

      // Trigger calculation
      const calculated = await registrationService.calculate(reg.id, {
        transform_type: transformType,
      });

      setActiveRegistration(calculated);
      setPreviewMode('comparison');
    } catch (err) {
      onError?.(`Calculation failed: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  // Automatic registration via OpenCV AKAZE/ORB RANSAC
  const handleAutoAlign = async () => {
    setIsAutoAligning(true);
    try {
      let reg = activeRegistration;
      if (!reg) {
        reg = await registrationService.create({
          case_id: currentCase.id,
          reference_slide_id: Number(refSlideId),
          moving_slide_id: Number(movingSlideId),
          registration_method: 'automatic',
          transform_type: transformType,
        });
        setActiveRegistration(reg);
      }

      const result = await registrationService.autoAlign(reg.id, {
        transform_type: transformType,
        detector: 'AKAZE',
      });

      setActiveRegistration(result);
      if (result.landmarks_json) setLandmarks(result.landmarks_json);
      setPreviewMode('comparison');
    } catch (err) {
      onError?.(`Automatic alignment failed: ${err.message}`);
    } finally {
      setIsAutoAligning(false);
    }
  };

  // Review & Approval Lifecycle (Draft -> Reviewed / Rejected)
  const handleReviewAction = async (status) => {
    if (!activeRegistration) return;
    setIsSaving(true);
    try {
      const reviewed = await registrationService.review(activeRegistration.id, {
        status,
        review_notes: reviewNotes,
      });
      setActiveRegistration(reviewed);
    } catch (err) {
      onError?.(`Could not update review status: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Audit history
  const loadHistory = async () => {
    if (!activeRegistration) return;
    try {
      const hist = await registrationService.getHistory(activeRegistration.id);
      setHistoryList(hist);
      setShowHistory(true);
    } catch (err) {
      onError?.(`Could not load history: ${err.message}`);
    }
  };

  const completeLandmarksCount = landmarks.filter(
    (lm) => lm.ref_x != null && lm.mov_x != null
  ).length;

  return (
    <div className="registration-workspace-modal" role="dialog" aria-modal="true">
      <div className="registration-workspace-container">
        {/* Workspace Header */}
        <header className="reg-workspace-header">
          <div className="reg-header-title">
            <Layers size={18} />
            <h2>Multi-Slide Spatial Registration</h2>
            <span className="reg-case-badge">Case {currentCase?.case_id}</span>
          </div>

          <div className="reg-header-actions">
            <button
              type="button"
              className="btn-control-secondary"
              onClick={loadHistory}
              disabled={!activeRegistration}
            >
              <History size={14} />
              Audit History
            </button>
            <button
              type="button"
              className="btn-reg-close"
              onClick={onClose}
              aria-label="Close registration workspace"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Workspace Body: Split into Left Config Sidebar & Main Stage */}
        <div className="reg-workspace-body">
          {/* Left Configuration Sidebar */}
          <aside className="reg-sidebar">
            {/* Slide Selection */}
            <section className="reg-sidebar-group">
              <label className="reg-group-title">Slide Pair</label>
              <div className="reg-slide-select-row">
                <div className="reg-select-field">
                  <span>Reference (Fixed):</span>
                  <select
                    value={refSlideId || ''}
                    onChange={(e) => setRefSlideId(e.target.value)}
                  >
                    {slides.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({s.stain || 'H&E'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="reg-select-field">
                  <span>Moving (Transformed):</span>
                  <select
                    value={movingSlideId || ''}
                    onChange={(e) => setMovingSlideId(e.target.value)}
                  >
                    {slides
                      .filter((s) => s.id !== Number(refSlideId))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.stain || 'IHC'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Registration Method & Transform Model */}
            <section className="reg-sidebar-group">
              <label className="reg-group-title">Transformation Model</label>
              <div className="transform-model-selector">
                {['translation', 'rigid', 'similarity', 'affine'].map((t) => (
                  <label key={t} className="radio-label">
                    <input
                      type="radio"
                      name="transformType"
                      value={t}
                      checked={transformType === t}
                      onChange={(e) => setTransformType(e.target.value)}
                    />
                    <span className="capitalize">{t}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Landmark Editor */}
            <LandmarkEditor
              landmarks={landmarks}
              activeLandmarkId={activeLandmarkId}
              onSelectLandmark={setActiveLandmarkId}
              onDeletePoint={handleDeleteLandmark}
              onClearPoints={handleClearLandmarks}
              disabled={isCalculating || isAutoAligning}
            />

            {/* Quality & Error Metrics Card */}
            {activeRegistration?.transform_matrix_json && (
              <RegistrationQuality
                registration={activeRegistration}
                transformMatrix={activeRegistration.transform_matrix_json}
                qualityMetrics={activeRegistration.quality_metrics_json}
              />
            )}

            {/* Review and Approval Status Actions */}
            {activeRegistration && (
              <section className="reg-sidebar-group reg-review-group">
                <label className="reg-group-title">Clinical Review</label>
                <textarea
                  className="review-notes-input"
                  placeholder="Clinical review notes or alignment verification remarks..."
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
                <div className="review-btn-row">
                  <button
                    type="button"
                    className="btn-review-approve"
                    onClick={() => handleReviewAction('Reviewed')}
                    disabled={isSaving}
                  >
                    <CheckCircle size={14} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-review-reject"
                    onClick={() => handleReviewAction('Rejected')}
                    disabled={isSaving}
                  >
                    <ShieldAlert size={14} />
                    Reject
                  </button>
                </div>
              </section>
            )}
          </aside>

          {/* Main Workspace Stage */}
          <main className="reg-main-stage">
            {/* Mode Switcher Banner */}
            <div className="reg-stage-nav">
              <div className="stage-nav-tabs">
                <button
                  type="button"
                  className={`btn-stage-tab ${previewMode === 'landmarks' ? 'btn-stage-tab--active' : ''}`}
                  onClick={() => setPreviewMode('landmarks')}
                >
                  <Crosshair size={14} />
                  1. Place Landmarks ({completeLandmarksCount} complete)
                </button>
                <button
                  type="button"
                  className={`btn-stage-tab ${previewMode === 'comparison' ? 'btn-stage-tab--active' : ''}`}
                  onClick={() => setPreviewMode('comparison')}
                  disabled={!activeRegistration?.transform_matrix_json}
                >
                  <Layers size={14} />
                  2. Registered Comparison
                </button>
              </div>

              <div className="stage-nav-actions">
                <button
                  type="button"
                  className="btn-action-primary"
                  onClick={handleCalculate}
                  disabled={isCalculating || completeLandmarksCount < (transformType === 'translation' ? 1 : transformType === 'affine' ? 3 : 2)}
                  title="Calculate mathematical alignment transform"
                >
                  <Play size={14} />
                  {isCalculating ? 'Calculating…' : 'Calculate Alignment'}
                </button>
                <button
                  type="button"
                  className="btn-action-auto"
                  onClick={handleAutoAlign}
                  disabled={isAutoAligning}
                  title="Automatically detect and match features via OpenCV"
                >
                  <Sparkles size={14} />
                  {isAutoAligning ? 'Matching Features…' : 'Auto-Align (OpenCV)'}
                </button>
              </div>
            </div>

            {/* Landmark Placement Dual Viewer */}
            {previewMode === 'landmarks' && (
              <div className="landmark-viewers-grid">
                {/* Reference Slide Viewer */}
                <div className="reg-viewer-card" onClick={handleRefCanvasClick}>
                  <div className="reg-viewer-badge">
                    <span>Reference: {refSlide?.label}</span>
                    <small>Click to place landmark point</small>
                  </div>
                  <div ref={refViewerContainerRef} className="reg-osd-container" />
                  <svg className="landmark-svg-layer" aria-hidden="true">
                    {landmarks.map((lm, idx) => {
                      if (lm.ref_x == null || lm.ref_y == null) return null;
                      const pt = imageToViewportRef(lm.ref_x, lm.ref_y);
                      return (
                        <g key={lm.id || idx} className="landmark-marker">
                          <circle cx={pt.x} cy={pt.y} r="8" fill="#e85d75" stroke="#ffffff" strokeWidth="2" />
                          <text x={pt.x} y={pt.y + 4} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                            {idx + 1}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Moving Slide Viewer */}
                <div className="reg-viewer-card" onClick={handleMovCanvasClick}>
                  <div className="reg-viewer-badge">
                    <span>Moving: {movingSlide?.label}</span>
                    <small>Click corresponding histological feature</small>
                  </div>
                  <div ref={movViewerContainerRef} className="reg-osd-container" />
                  <svg className="landmark-svg-layer" aria-hidden="true">
                    {landmarks.map((lm, idx) => {
                      if (lm.mov_x == null || lm.mov_y == null) return null;
                      const pt = imageToViewportMov(lm.mov_x, lm.mov_y);
                      return (
                        <g key={lm.id || idx} className="landmark-marker">
                          <circle cx={pt.x} cy={pt.y} r="8" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
                          <text x={pt.x} y={pt.y + 4} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                            {idx + 1}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Registered Comparison (Side-by-side, Overlay, Swipe) */}
            {previewMode === 'comparison' && (
              <RegisteredComparison
                refSlide={refSlide}
                movingSlide={movingSlide}
                transformMatrix={activeRegistration?.transform_matrix_json}
                mode={compSubMode}
                onModeChange={setCompSubMode}
              />
            )}
          </main>
        </div>

        {/* Audit History Modal */}
        {showHistory && (
          <div className="history-modal-overlay" onClick={() => setShowHistory(false)}>
            <div className="history-modal" onClick={(e) => e.stopPropagation()}>
              <header className="history-modal-header">
                <strong>Registration Audit History</strong>
                <button type="button" onClick={() => setShowHistory(false)}>
                  <X size={15} />
                </button>
              </header>
              <div className="history-list">
                {historyList.length === 0 ? (
                  <p className="history-empty">No lifecycle audit records.</p>
                ) : (
                  historyList.map((h) => (
                    <div key={h.id} className="history-item">
                      <div className="history-action-row">
                        <strong>{h.action}</strong>
                        <span>by {h.actor}</span>
                        <time>{new Date(h.created_at).toLocaleString()}</time>
                      </div>
                      {h.details_json && (
                        <pre className="history-details">
                          {JSON.stringify(h.details_json, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
