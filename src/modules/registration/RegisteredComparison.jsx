import { useState, useRef, useEffect, useCallback } from 'react';
import OpenSeadragon from 'openseadragon';
import { Columns, Layers, Sliders, SplitSquareVertical } from 'lucide-react';
import { API_BASE_URL as API } from '../../config';
import './RegisteredComparison.css';

export default function RegisteredComparison({
  refSlide,
  movingSlide,
  transformMatrix, // 3x3 array [[a, b, tx], [c, d, ty], [0, 0, 1]]
  mode = 'side-by-side', // 'side-by-side' | 'overlay' | 'swipe'
  onModeChange,
}) {
  const refContainerRef = useRef(null);
  const movContainerRef = useRef(null);
  const refViewerRef = useRef(null);
  const movViewerRef = useRef(null);

  const [opacity, setOpacity] = useState(0.5);
  const [swipePos, setSwipePos] = useState(50); // percentage 0-100
  const [syncEnabled, setSyncEnabled] = useState(true);
  const isDraggingSwipe = useRef(false);
  const swipeContainerRef = useRef(null);

  // Helper to transform Point from Reference Level-0 to Moving Level-0 coords
  const transformRefToMoving = useCallback((rx, ry) => {
    if (!transformMatrix || transformMatrix.length < 2) return { x: rx, y: ry };
    const m = transformMatrix;
    const mx = m[0][0] * rx + m[0][1] * ry + m[0][2];
    const my = m[1][0] * rx + m[1][1] * ry + m[1][2];
    return { x: mx, y: my };
  }, [transformMatrix]);

  // Helper to transform Point from Moving Level-0 to Reference Level-0 coords
  const transformMovingToRef = useCallback((mx, my) => {
    if (!transformMatrix || transformMatrix.length < 2) return { x: mx, y: my };
    const m = transformMatrix;
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (Math.abs(det) < 1e-9) return { x: mx, y: my };
    const inv00 = m[1][1] / det;
    const inv01 = -m[0][1] / det;
    const inv10 = -m[1][0] / det;
    const inv11 = m[0][0] / det;
    const dx = mx - m[0][2];
    const dy = my - m[1][2];
    return {
      x: inv00 * dx + inv01 * dy,
      y: inv10 * dx + inv11 * dy,
    };
  }, [transformMatrix]);

  // Initialize Reference OpenSeadragon Viewer
  useEffect(() => {
    if (!refContainerRef.current || !refSlide) return;
    let dziUrl = refSlide.dzi_url;
    if (dziUrl && dziUrl.startsWith('/') && API) dziUrl = `${API}${dziUrl}`;

    const viewer = OpenSeadragon({
      element: refContainerRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      showNavigator: false,
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      visibilityRatio: 0.5,
      crossOriginPolicy: 'Anonymous',
      ajaxWithCredentials: true,
    });
    refViewerRef.current = viewer;

    return () => {
      refViewerRef.current = null;
      viewer.destroy();
    };
  }, [refSlide]);

  // Initialize Moving OpenSeadragon Viewer
  useEffect(() => {
    if (!movContainerRef.current || !movingSlide) return;
    let dziUrl = movingSlide.dzi_url;
    if (dziUrl && dziUrl.startsWith('/') && API) dziUrl = `${API}${dziUrl}`;

    const viewer = OpenSeadragon({
      element: movContainerRef.current,
      tileSources: dziUrl,
      showNavigationControl: false,
      showNavigator: false,
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      visibilityRatio: 0.5,
      crossOriginPolicy: 'Anonymous',
      ajaxWithCredentials: true,
    });
    movViewerRef.current = viewer;

    return () => {
      movViewerRef.current = null;
      viewer.destroy();
    };
  }, [movingSlide]);

  // Synchronized registered navigation: Reference -> Moving
  useEffect(() => {
    const vRef = refViewerRef.current;
    const vMov = movViewerRef.current;
    if (!vRef || !vMov || !syncEnabled) return;

    let isUpdating = false;

    const syncHandler = () => {
      if (isUpdating) return;
      const itemRef = vRef.world?.getItemAt(0);
      const itemMov = vMov.world?.getItemAt(0);
      if (!itemRef || !itemMov) return;

      isUpdating = true;
      try {
        // 1. Get Reference center in Level-0 coordinates
        const centerVp = vRef.viewport.getCenter(true);
        const centerImgRef = itemRef.viewportToImageCoordinates(centerVp);

        // 2. Transform through registration matrix
        const centerImgMov = transformRefToMoving(centerImgRef.x, centerImgRef.y);

        // 3. Convert to Moving viewport coordinates and pan
        const targetVp = itemMov.imageToViewportCoordinates(new OpenSeadragon.Point(centerImgMov.x, centerImgMov.y));
        vMov.viewport.panTo(targetVp, true);

        // 4. Calculate relative zoom scaling from matrix
        let scale = 1.0;
        if (transformMatrix) {
          scale = Math.hypot(transformMatrix[0][0], transformMatrix[0][1]);
        }
        const zoomRef = vRef.viewport.getZoom(true);
        vMov.viewport.zoomTo(zoomRef * (scale || 1), null, true);

        // 5. Calculate rotation angle from matrix
        if (transformMatrix) {
          const rotDeg = (Math.atan2(transformMatrix[1][0], transformMatrix[0][0]) * 180) / Math.PI;
          vMov.viewport.setRotation(vRef.viewport.getRotation() + rotDeg);
        }
      } catch (err) {
        // Ignore math bounds during initial tile loading
      } finally {
        setTimeout(() => {
          isUpdating = false;
        }, 30);
      }
    };

    vRef.addHandler('pan', syncHandler);
    vRef.addHandler('zoom', syncHandler);
    vRef.addHandler('animation', syncHandler);

    return () => {
      vRef.removeHandler('pan', syncHandler);
      vRef.removeHandler('zoom', syncHandler);
      vRef.removeHandler('animation', syncHandler);
    };
  }, [syncEnabled, transformRefToMoving, transformMatrix]);

  // Mouse / Touch handlers for Swipe divider dragging
  const onSwipeStart = (e) => {
    isDraggingSwipe.current = true;
    e.preventDefault();
  };

  const onSwipeMove = useCallback((e) => {
    if (!isDraggingSwipe.current || !swipeContainerRef.current) return;
    const rect = swipeContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    if (clientX == null) return;
    const offset = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (offset / rect.width) * 100));
    setSwipePos(pct);
  }, []);

  const onSwipeEnd = useCallback(() => {
    isDraggingSwipe.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onSwipeMove);
    window.addEventListener('pointerup', onSwipeEnd);
    return () => {
      window.removeEventListener('pointermove', onSwipeMove);
      window.removeEventListener('pointerup', onSwipeEnd);
    };
  }, [onSwipeMove, onSwipeEnd]);

  return (
    <div className="registered-comparison" aria-label="Registered slide comparison">
      {/* Comparison Toolbar */}
      <div className="registered-comparison-toolbar">
        <div className="comp-mode-tabs" role="tablist">
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'side-by-side' ? 'btn-mode-tab--active' : ''}`}
            onClick={() => onModeChange('side-by-side')}
          >
            <Columns size={14} />
            Side-by-Side
          </button>
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'overlay' ? 'btn-mode-tab--active' : ''}`}
            onClick={() => onModeChange('overlay')}
          >
            <Layers size={14} />
            Overlay Blend
          </button>
          <button
            type="button"
            className={`btn-mode-tab ${mode === 'swipe' ? 'btn-mode-tab--active' : ''}`}
            onClick={() => onModeChange('swipe')}
          >
            <SplitSquareVertical size={14} />
            Swipe Divider
          </button>
        </div>

        <div className="comp-controls-group">
          {mode === 'overlay' && (
            <div className="opacity-slider-control">
              <Sliders size={13} />
              <span>Opacity: {Math.round(opacity * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                aria-label="Overlay moving slide opacity"
              />
              <button
                type="button"
                className="btn-quick-opacity"
                onClick={() => setOpacity(0.5)}
              >
                50/50
              </button>
            </div>
          )}

          <label className="sync-toggle-label">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
            />
            <span>Spatially Registered Sync</span>
          </label>
        </div>
      </div>

      {/* Main Comparison Area */}
      <div
        ref={swipeContainerRef}
        className={`registered-viewport-area mode-${mode}`}
      >
        {/* Reference Container */}
        <div className="ref-viewport-container">
          <div className="viewport-label">
            <span>Reference</span>
            <strong>{refSlide?.label}</strong>
          </div>
          <div ref={refContainerRef} className="openseadragon-stage" />
        </div>

        {/* Moving Container (Side-by-side or Layered) */}
        <div
          className="mov-viewport-container"
          style={{
            opacity: mode === 'overlay' ? opacity : 1,
            clipPath: mode === 'swipe' ? `inset(0 0 0 ${swipePos}%)` : 'none',
          }}
        >
          <div className="viewport-label">
            <span>Moving (Transformed)</span>
            <strong>{movingSlide?.label}</strong>
          </div>
          <div ref={movContainerRef} className="openseadragon-stage" />
        </div>

        {/* Swipe Handle */}
        {mode === 'swipe' && (
          <div
            className="swipe-divider-line"
            style={{ left: `${swipePos}%` }}
            onPointerDown={onSwipeStart}
          >
            <div className="swipe-handle">
              <SplitSquareVertical size={14} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
