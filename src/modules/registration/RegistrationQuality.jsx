import { Activity, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import './RegistrationQuality.css';

export default function RegistrationQuality({
  registration,
  qualityMetrics = null,
  transformMatrix = null,
}) {
  const metrics = qualityMetrics || registration?.quality_metrics_json || {};
  const status = registration?.status || 'Draft';
  const method = registration?.registration_method || 'manual';
  const transformType = registration?.transform_type || 'affine';

  const meanError = metrics.mean_residual_px;
  const maxError = metrics.max_residual_px;
  const numLandmarks = metrics.num_landmarks ?? registration?.landmarks_json?.length ?? 0;
  const inliers = metrics.inliers_count;
  const micronError = metrics.mean_residual_microns;

  const isHighError = meanError != null && meanError > 25;

  return (
    <div className="registration-quality-card" aria-label="Registration quality metrics">
      <div className="quality-header">
        <div className="quality-title">
          <Activity size={15} />
          <strong>Alignment Quality</strong>
        </div>
        <span className={`status-pill status-pill--${status.toLowerCase()}`}>
          {status}
        </span>
      </div>

      <div className="quality-grid">
        <div className="quality-stat">
          <span className="stat-label">Method</span>
          <strong className="stat-val capitalize">{method}</strong>
        </div>
        <div className="quality-stat">
          <span className="stat-label">Model</span>
          <strong className="stat-val capitalize">{transformType}</strong>
        </div>
        <div className="quality-stat">
          <span className="stat-label">Landmarks / Inliers</span>
          <strong className="stat-val">
            {numLandmarks} {inliers != null ? `(${inliers} inliers)` : ''}
          </strong>
        </div>
        <div className="quality-stat">
          <span className="stat-label">Mean Residual</span>
          <strong className={`stat-val ${isHighError ? 'stat-val--warning' : ''}`}>
            {meanError != null ? `${meanError.toFixed(2)} px` : '—'}
            {micronError != null && ` (${micronError.toFixed(1)} µm)`}
          </strong>
        </div>
        <div className="quality-stat">
          <span className="stat-label">Max Residual</span>
          <strong className="stat-val">
            {maxError != null ? `${maxError.toFixed(2)} px` : '—'}
          </strong>
        </div>
      </div>

      {isHighError && (
        <div className="quality-warning">
          <AlertTriangle size={14} />
          <span>
            Mean residual error exceeds recommended threshold (25 px). Verify landmark placements or consider rigid model.
          </span>
        </div>
      )}

      {transformMatrix && (
        <div className="matrix-preview">
          <span className="matrix-label">Affine Transform Matrix (Level-0):</span>
          <pre className="matrix-code">
            {Array.isArray(transformMatrix)
              ? transformMatrix.map((row) => row.map((v) => Number(v).toFixed(4)).join('  ')).join('\n')
              : JSON.stringify(transformMatrix)}
          </pre>
        </div>
      )}
    </div>
  );
}
