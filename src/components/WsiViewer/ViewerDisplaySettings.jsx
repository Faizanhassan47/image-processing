import { RotateCcw, Save, Sliders, X } from 'lucide-react';
import './ViewerDisplaySettings.css';

export default function ViewerDisplaySettings({
  brightness,
  setBrightness,
  contrast,
  setContrast,
  gamma,
  setGamma,
  displayProfile,
  setDisplayProfile,
  profiles = {},
  onReset,
  onSavePreferences,
  saving = false,
  onClose,
}) {
  return (
    <aside className="viewer-display-settings-panel" aria-label="Image display adjustments">
      <header className="panel-header">
        <div className="panel-title">
          <Sliders size={15} />
          <strong>Display Adjustments</strong>
        </div>
        <button
          type="button"
          className="btn-panel-close"
          onClick={onClose}
          aria-label="Close adjustments panel"
        >
          <X size={15} />
        </button>
      </header>

      <div className="panel-body">
        {/* Color Profile Preset */}
        <div className="setting-row">
          <label htmlFor="display-profile-select">Color profile</label>
          <select
            id="display-profile-select"
            value={displayProfile}
            onChange={(e) => setDisplayProfile(e.target.value)}
          >
            {Object.entries(profiles).map(([key, [label]]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Brightness Slider */}
        <div className="setting-row">
          <div className="slider-label-row">
            <label htmlFor="brightness-slider">Brightness</label>
            <span className="slider-value">{brightness}%</span>
          </div>
          <input
            id="brightness-slider"
            type="range"
            min="50"
            max="180"
            step="1"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
          />
        </div>

        {/* Contrast Slider */}
        <div className="setting-row">
          <div className="slider-label-row">
            <label htmlFor="contrast-slider">Contrast</label>
            <span className="slider-value">{contrast}%</span>
          </div>
          <input
            id="contrast-slider"
            type="range"
            min="50"
            max="180"
            step="1"
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
          />
        </div>

        {/* Gamma Slider */}
        <div className="setting-row">
          <div className="slider-label-row">
            <label htmlFor="gamma-slider">Gamma</label>
            <span className="slider-value">{gamma.toFixed(2)}</span>
          </div>
          <input
            id="gamma-slider"
            type="range"
            min="0.4"
            max="2.5"
            step="0.05"
            value={gamma}
            onChange={(e) => setGamma(Number(e.target.value))}
          />
        </div>
      </div>

      <footer className="panel-footer">
        <button
          type="button"
          className="btn-control-secondary"
          onClick={onReset}
          title="Reset display adjustments to defaults"
        >
          <RotateCcw size={13} />
          Reset
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onSavePreferences}
          disabled={saving}
          title="Save as default viewing preference for this slide"
        >
          <Save size={13} />
          {saving ? 'Saving…' : 'Save Default'}
        </button>
      </footer>
    </aside>
  );
}
