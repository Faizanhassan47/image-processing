import { Keyboard, X } from 'lucide-react';
import './ViewerShortcutsModal.css';

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation & Zoom',
    shortcuts: [
      { key: '+ / =', description: 'Zoom in' },
      { key: '- / _', description: 'Zoom out' },
      { key: 'F', description: 'Fit slide to viewport' },
      { key: '0', description: 'Reset zoom and orientation' },
      { key: 'Arrows', description: 'Pan viewport' },
    ],
  },
  {
    title: 'Orientation & Display',
    shortcuts: [
      { key: 'R', description: 'Rotate 90° clockwise' },
      { key: 'Shift + R', description: 'Rotate 90° counter-clockwise' },
      { key: 'H', description: 'Toggle horizontal flip' },
      { key: 'V', description: 'Toggle vertical flip' },
      { key: 'M', description: 'Toggle navigator minimap' },
      { key: 'T', description: 'Toggle review trail coverage' },
      { key: 'A', description: 'Toggle annotations layer' },
    ],
  },
  {
    title: 'Workflows & Tools',
    shortcuts: [
      { key: 'B', description: 'Save current viewpoint' },
      { key: '1 - 5', description: 'Select annotation tool (Point, Rect, Poly, Line)' },
      { key: 'Esc', description: 'Cancel current tool / Exit fullscreen' },
      { key: 'F11', description: 'Toggle fullscreen mode' },
    ],
  },
];

export default function ViewerShortcutsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="shortcuts-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <header className="shortcuts-modal-header">
          <div className="shortcuts-modal-title">
            <Keyboard size={16} />
            <strong id="shortcuts-title">Keyboard Shortcuts</strong>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </header>

        <div className="shortcuts-modal-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="shortcuts-group">
              <h4>{group.title}</h4>
              <div className="shortcuts-table">
                {group.shortcuts.map((s) => (
                  <div key={s.key} className="shortcut-row">
                    <span className="shortcut-desc">{s.description}</span>
                    <kbd className="shortcut-key">{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
