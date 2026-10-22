import { Trash2 } from 'lucide-react';
import './ViewerTrail.css';

export default function ViewerTrail({
  visible = true,
  boxes = [],
  imageToViewport,
  onClear,
}) {
  if (!visible || !imageToViewport || boxes.length === 0) return null;

  return (
    <>
      <svg className="viewer-trail-overlay" aria-hidden="true">
        {boxes.map((box, idx) => {
          const p1 = imageToViewport(box.x, box.y);
          const p2 = imageToViewport(box.x + box.w, box.y + box.h);
          const w = Math.max(1, p2.x - p1.x);
          const h = Math.max(1, p2.y - p1.y);
          return (
            <rect
              key={idx}
              x={p1.x}
              y={p1.y}
              width={w}
              height={h}
              className="trail-box"
            />
          );
        })}
      </svg>
      <div className="trail-badge-container">
        <span className="trail-badge">
          Review Coverage: {boxes.length} region{boxes.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className="btn-trail-clear"
          onClick={onClear}
          title="Clear current review trail"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>
    </>
  );
}
