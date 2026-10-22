import { useState } from 'react';
import { Bookmark, Edit2, Check, Trash2, Eye, X } from 'lucide-react';
import './ViewerBookmarksModal.css';

export default function ViewerBookmarksModal({
  open,
  onClose,
  bookmarks = [],
  onRestore,
  onRename,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  if (!open) return null;

  const startRename = (bm) => {
    setEditingId(bm.id);
    setEditName(bm.name);
  };

  const submitRename = (bm) => {
    if (editName.trim()) {
      onRename(bm.id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="viewpoints-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="viewpoints-title">
      <div className="viewpoints-modal" onClick={(e) => e.stopPropagation()}>
        <header className="viewpoints-modal-header">
          <div className="viewpoints-modal-title">
            <Bookmark size={16} />
            <strong id="viewpoints-title">Saved Viewpoints & Sessions</strong>
            <span className="viewpoints-count">{bookmarks.length}</span>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </header>

        <div className="viewpoints-modal-body">
          {bookmarks.length === 0 ? (
            <div className="viewpoints-empty">
              <p>No saved viewpoints for this slide yet.</p>
              <small>Use "Save view" in the top toolbar to store your current magnification, coordinates, rotation, and display settings.</small>
            </div>
          ) : (
            <div className="viewpoints-list">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="viewpoint-card">
                  <div className="viewpoint-info">
                    {editingId === bm.id ? (
                      <div className="viewpoint-edit-row">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submitRename(bm)}
                          autoFocus
                        />
                        <button type="button" className="btn-icon" onClick={() => submitRename(bm)} title="Save name">
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="viewpoint-name-row">
                        <strong>{bm.name}</strong>
                        <button type="button" className="btn-icon-subtle" onClick={() => startRename(bm)} title="Rename viewpoint">
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                    <div className="viewpoint-meta">
                      <span>Rotation: {Math.round(bm.rotation || 0)}°</span>
                      {(bm.flip_h || bm.flip_v) && <span>Flip: {bm.flip_h ? 'H' : ''}{bm.flip_v ? 'V' : ''}</span>}
                      <span>Brightness: {bm.brightness ?? 100}%</span>
                      <span>Contrast: {bm.contrast ?? 100}%</span>
                      {bm.gamma && bm.gamma !== 1.0 && <span>γ: {Number(bm.gamma).toFixed(2)}</span>}
                    </div>
                  </div>

                  <div className="viewpoint-actions">
                    <button
                      type="button"
                      className="btn-control-secondary"
                      onClick={() => { onRestore(bm); onClose(); }}
                      title="Restore this viewpoint"
                    >
                      <Eye size={13} />
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn-delete-icon"
                      onClick={() => onDelete(bm)}
                      title="Delete saved viewpoint"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
