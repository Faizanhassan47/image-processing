import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, RotateCw,
  FlipHorizontal, FlipVertical, Sliders, Map, Footprints,
  Eye, EyeOff, Bookmark, BookmarkCheck, SplitSquareVertical,
  Circle, Keyboard, PenTool, Square, Expand, Minimize2
} from 'lucide-react';
import './ViewerToolbar.css';

export default function ViewerToolbar({
  // Navigation & Zoom
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  // Rotation
  onRotateCw,
  onRotateCcw,
  onRotate180,
  rotation = 0,
  // Flip
  onFlipH,
  onFlipV,
  onResetFlip,
  flipH = false,
  flipV = false,
  // Adjustments & Filters
  showAdjustments,
  onToggleAdjustments,
  brightness = 100,
  contrast = 100,
  gamma = 1.0,
  // Overlays & Modes
  minimapVisible,
  onToggleMinimap,
  trailVisible,
  onToggleTrail,
  annotationsVisible,
  onToggleAnnotations,
  // Bookmarks / Viewpoints
  onSaveViewpoint,
  showViewpoints,
  onToggleViewpoints,
  // Registration / Compare
  onOpenRegistration,
  onOpenCompare,
  canRegister = false,
  // Fullscreen & Shortcuts
  fullscreen,
  onToggleFullscreen,
  onOpenShortcuts,
  // Draw Mode & Controls
  drawMode,
  setDrawMode,
}) {
  const isAdjusted = brightness !== 100 || contrast !== 100 || gamma !== 1.0;
  const isTransformed = rotation !== 0 || flipH || flipV;

  return (
    <nav className="advanced-viewer-toolbar" aria-label="Whole-slide image controls">
      {/* Group 1: Zoom & Navigation */}
      <div className="toolbar-group" role="group" aria-label="Zoom and View">
        <button
          type="button"
          className="btn-toolbar"
          onClick={onFit}
          title="Fit slide to window (F)"
          aria-label="Fit slide to window"
        >
          <Maximize2 size={16} />
          <span className="toolbar-btn-text">Fit</span>
        </button>
        <button
          type="button"
          className="btn-toolbar"
          onClick={onReset}
          title="Reset viewpoint (0)"
          aria-label="Reset viewpoint"
        >
          <RotateCcw size={16} />
          <span className="toolbar-btn-text">Reset</span>
        </button>
      </div>

      <div className="toolbar-separator" aria-hidden="true" />

      {/* Group 2: Rotation & Flip */}
      <div className="toolbar-group" role="group" aria-label="Orientation and Flip">
        <button
          type="button"
          className="btn-toolbar"
          onClick={onRotateCw}
          title="Rotate 90° clockwise (R)"
          aria-label="Rotate clockwise"
        >
          <RotateCw size={16} />
          <span className="toolbar-badge">{rotation ? `${rotation}°` : ''}</span>
        </button>
        <button
          type="button"
          className="btn-toolbar"
          onClick={onRotateCcw}
          title="Rotate 90° counter-clockwise (Shift + R)"
          aria-label="Rotate counter-clockwise"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className={`btn-toolbar ${flipH ? 'btn-toolbar--active' : ''}`}
          onClick={onFlipH}
          title="Flip horizontally"
          aria-pressed={flipH}
          aria-label="Flip horizontally"
        >
          <FlipHorizontal size={16} />
        </button>
        <button
          type="button"
          className={`btn-toolbar ${flipV ? 'btn-toolbar--active' : ''}`}
          onClick={onFlipV}
          title="Flip vertically"
          aria-pressed={flipV}
          aria-label="Flip vertically"
        >
          <FlipVertical size={16} />
        </button>
      </div>

      <div className="toolbar-separator" aria-hidden="true" />

      {/* Group 3: Image Adjustments Panel Trigger */}
      <div className="toolbar-group" role="group" aria-label="Image Adjustments">
        <button
          type="button"
          className={`btn-toolbar ${showAdjustments ? 'btn-toolbar--active' : ''} ${isAdjusted ? 'btn-toolbar--highlight' : ''}`}
          onClick={onToggleAdjustments}
          title="Image adjustments: Brightness, Contrast, Gamma"
          aria-pressed={showAdjustments}
          aria-label="Adjust image brightness, contrast, and gamma"
        >
          <Sliders size={16} />
          <span className="toolbar-btn-text">Adjust</span>
          {isAdjusted && <span className="toolbar-dot" aria-label="Adjusted" />}
        </button>
      </div>

      <div className="toolbar-separator" aria-hidden="true" />

      <div className="toolbar-group" role="group" aria-label="Draw analysis region">
        <button type="button" className={`btn-toolbar ${drawMode === 'rectangle' ? 'btn-toolbar--active' : ''}`} onClick={() => setDrawMode(drawMode === 'rectangle' ? null : 'rectangle')} title="Draw rectangular analysis region" aria-pressed={drawMode === 'rectangle'}><Square size={16} /><span className="toolbar-btn-text">Rectangle</span></button>
        <button type="button" className={`btn-toolbar ${drawMode === 'ellipse' ? 'btn-toolbar--active' : ''}`} onClick={() => setDrawMode(drawMode === 'ellipse' ? null : 'ellipse')} title="Draw circular or oval analysis region" aria-pressed={drawMode === 'ellipse'}><Circle size={16} /><span className="toolbar-btn-text">Circle</span></button>
        <button type="button" className={`btn-toolbar ${drawMode === 'freehand' ? 'btn-toolbar--active' : ''}`} onClick={() => setDrawMode(drawMode === 'freehand' ? null : 'freehand')} title="Draw a freehand analysis region" aria-pressed={drawMode === 'freehand'}><PenTool size={16} /><span className="toolbar-btn-text">Pen</span></button>
      </div>

      <div className="toolbar-separator" aria-hidden="true" />

      {/* Group 4: Overlay & Layer Toggles */}
      <div className="toolbar-group" role="group" aria-label="Overlays and Layers">
        <button
          type="button"
          className={`btn-toolbar ${minimapVisible ? 'btn-toolbar--active' : ''}`}
          onClick={onToggleMinimap}
          title="Toggle navigator minimap (M)"
          aria-pressed={minimapVisible}
          aria-label="Toggle navigator minimap"
        >
          <Map size={16} />
          <span className="toolbar-btn-text">Minimap</span>
        </button>
        <button
          type="button"
          className={`btn-toolbar ${trailVisible ? 'btn-toolbar--active' : ''}`}
          onClick={onToggleTrail}
          title="Toggle viewing trail coverage (T)"
          aria-pressed={trailVisible}
          aria-label="Toggle viewing trail coverage"
        >
          <Footprints size={16} />
          <span className="toolbar-btn-text">Trail</span>
        </button>
        <button
          type="button"
          className={`btn-toolbar ${annotationsVisible ? 'btn-toolbar--active' : ''}`}
          onClick={onToggleAnnotations}
          title="Toggle annotations layer (A)"
          aria-pressed={annotationsVisible}
          aria-label="Toggle annotations visibility"
        >
          {annotationsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          <span className="toolbar-btn-text">Annotations</span>
        </button>
      </div>
      {/* Group 6: Multi-Slide Registration & Compare */}
      <div className="toolbar-group" role="group" aria-label="Slide Comparison and Registration">
        {canRegister && (
          <button
            type="button"
            className="btn-toolbar btn-toolbar--accent"
            onClick={onOpenRegistration}
            title="Open Multi-Slide Registration Workspace"
            aria-label="Register slides"
          >
            <SplitSquareVertical size={16} />
            <span className="toolbar-btn-text">Register slides</span>
          </button>
        )}
      </div>

      {/* Group 7: Utility (Shortcuts, Fullscreen) */}
      <div className="toolbar-group toolbar-group--right" role="group" aria-label="Utilities">
        <button
          type="button"
          className="btn-toolbar"
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (F11)'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Expand size={16} />}
        </button>
      </div>
    </nav>
  );
}
