import { Trash2, Plus, Crosshair } from 'lucide-react';
import './LandmarkEditor.css';

export default function LandmarkEditor({
  landmarks = [],
  activeLandmarkId,
  onSelectLandmark,
  onAddPoint,
  onDeletePoint,
  onClearPoints,
  disabled = false,
}) {
  return (
    <div className="landmark-editor" aria-label="Registration landmarks panel">
      <div className="landmark-editor-header">
        <div className="landmark-title">
          <Crosshair size={15} />
          <strong>Landmarks ({landmarks.length})</strong>
        </div>
        <div className="landmark-header-actions">
          <button
            type="button"
            className="btn-landmark-clear"
            onClick={onClearPoints}
            disabled={disabled || landmarks.length === 0}
            title="Clear all landmarks"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      <div className="landmark-instructions">
        <p>
          Click corresponding histological landmarks on both slides.
          Pairs are color-coded and numbered.
        </p>
      </div>

      <div className="landmark-list">
        {landmarks.length === 0 ? (
          <div className="landmark-empty">
            No landmarks placed yet. Click on the reference slide to begin placing pair #1.
          </div>
        ) : (
          landmarks.map((lm, idx) => {
            const hasRef = lm.ref_x != null && lm.ref_y != null;
            const hasMov = lm.mov_x != null && lm.mov_y != null;
            const isComplete = hasRef && hasMov;
            const isSelected = activeLandmarkId === lm.id;

            return (
              <div
                key={lm.id || idx}
                className={`landmark-item ${isSelected ? 'landmark-item--active' : ''} ${isComplete ? 'landmark-item--complete' : 'landmark-item--incomplete'}`}
                onClick={() => onSelectLandmark?.(lm.id)}
              >
                <div className="landmark-badge">#{idx + 1}</div>
                <div className="landmark-coords">
                  <div className={`coord-cell ${hasRef ? '' : 'coord-cell--missing'}`}>
                    <small>Ref (L0):</small>
                    <span>
                      {hasRef ? `${Math.round(lm.ref_x)}, ${Math.round(lm.ref_y)}` : 'Click Ref'}
                    </span>
                  </div>
                  <div className={`coord-cell ${hasMov ? '' : 'coord-cell--missing'}`}>
                    <small>Moving (L0):</small>
                    <span>
                      {hasMov ? `${Math.round(lm.mov_x)}, ${Math.round(lm.mov_y)}` : 'Click Moving'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-landmark-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePoint?.(lm.id);
                  }}
                  title="Remove this pair"
                  disabled={disabled}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
