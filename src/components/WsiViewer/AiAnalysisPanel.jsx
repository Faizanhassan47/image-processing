/**
 * AiAnalysisPanel.jsx
 *
 * HoVer-Net AI nucleus analysis panel for the WSI viewer sidebar.
 * Displays run controls, 6-class PanNuke breakdown, nucleus stats,
 * morphology metrics, history selector, and PDF download.
 *
 * Constraints:
 *  - No inline styles — all CSS in AiAnalysisPanel.css
 *  - Research Use Only disclaimer always visible when results present
 *  - Confidence scores are genuine type_prob values from the model
 *  - Overlays are managed via callbacks into WsiViewer (parent)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ChevronDown, Download,
  Loader2, Play, RefreshCw, X, Zap
} from 'lucide-react';
import { viewerService } from '../../services/viewerService';
import './AiAnalysisPanel.css';

// ── PanNuke 6-class colour palette ──────────────────────────────────────────
export const PANNUKE_CLASSES = [
  { key: 'Neoplastic',    label: 'Neoplastic',     color: '#e85d75' },
  { key: 'Inflammatory',  label: 'Inflammatory',   color: '#f59e0b' },
  { key: 'Connective',    label: 'Connective',     color: '#3b82f6' },
  { key: 'Dead',          label: 'Dead',           color: '#94a3b8' },
  { key: 'Epithelial',    label: 'Epithelial',     color: '#10b981' },
  { key: 'No Label',      label: 'No Label',       color: '#6366f1' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function pct(count, total) {
  if (!total) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function fmtConf(raw) {
  if (raw == null) return '—';
  return `${(raw * 100).toFixed(1)}%`;
}

function fmtNum(v, decimals = 1) {
  if (v == null) return '—';
  return Number(v).toFixed(decimals);
}

function fmtDensity(v) {
  if (v == null) return '—';
  return `${Number(v).toFixed(0)} /mm²`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClassTable({ breakdown, totalNuclei, hiddenClasses, onToggleClass }) {
  if (!breakdown || !Object.keys(breakdown).length) return null;
  return (
    <div className="ai-class-section">
      <div className="ai-class-section-heading">
        <h4>PanNuke class breakdown</h4>
      </div>
      <table className="ai-class-table" aria-label="Nucleus class breakdown">
        <thead>
          <tr>
            <th>Class</th>
            <th>N</th>
            <th>%</th>
            <th aria-label="Distribution" className="ai-class-bar-cell" />
            <th aria-label="Toggle visibility" />
          </tr>
        </thead>
        <tbody>
          {PANNUKE_CLASSES.map(({ key, label, color }) => {
            const count = breakdown[key] ?? 0;
            const hidden = hiddenClasses.has(key);
            const widthPct = totalNuclei ? Math.round((count / totalNuclei) * 100) : 0;
            return (
              <tr key={key} className={`ai-class-row${hidden ? ' ai-class-row--hidden' : ''}`}>
                <td>
                  <span className="ai-class-chip">
                    <span className="ai-class-swatch" style={{ background: color }} aria-hidden="true" />
                    {label}
                  </span>
                </td>
                <td>{count}</td>
                <td className="ai-class-pct">{pct(count, totalNuclei)}</td>
                <td className="ai-class-bar-cell">
                  <div className="ai-class-bar-track" aria-hidden="true">
                    <div
                      className="ai-class-bar-fill"
                      style={{ width: `${widthPct}%`, background: color }}
                    />
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className={`ai-toggle-btn${hidden ? ' ai-toggle-btn--hidden' : ''}`}
                    title={hidden ? `Show ${label}` : `Hide ${label}`}
                    aria-pressed={!hidden}
                    onClick={() => onToggleClass(key)}
                    aria-label={`Toggle ${label} overlay`}
                  >
                    {hidden ? '·' : '✓'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MorphologyMetrics({ morphology, density }) {
  if (!morphology) return null;
  const items = [
    { label: 'Median area',        value: `${fmtNum(morphology.area_median)} px²` },
    { label: 'Median perimeter',   value: `${fmtNum(morphology.perimeter_median)} px` },
    { label: 'Median circularity', value: fmtNum(morphology.circularity_median, 3) },
    { label: 'Median aspect ratio',value: fmtNum(morphology.aspect_ratio_median, 3) },
    { label: 'Nuclear density',    value: fmtDensity(density) },
    { label: 'Total detected',     value: morphology.total_nuclei ?? '—' },
  ];
  return (
    <div className="ai-morph-section">
      <h4>Morphology metrics</h4>
      <div className="ai-morph-grid">
        {items.map(({ label, value }) => (
          <div key={label} className="ai-morph-item">
            <span className="ai-morph-label">{label}</span>
            <span className="ai-morph-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NucleusDetail({ nucleus, onClose }) {
  if (!nucleus) return null;
  const cls = PANNUKE_CLASSES.find((c) => c.key === nucleus.type) || { color: '#94a3b8', label: nucleus.type };
  return (
    <div className="ai-nucleus-detail" role="region" aria-label="Selected nucleus detail">
      <div className="ai-nucleus-detail-header">
        <strong>
          <span className="ai-class-swatch" style={{ background: cls.color, display: 'inline-block', marginRight: 6 }} aria-hidden="true" />
          {cls.label}
        </strong>
        <button type="button" className="ai-nucleus-detail-close" onClick={onClose} aria-label="Close nucleus detail">
          <X size={13} />
        </button>
      </div>
      <dl className="ai-nucleus-detail-rows">
        <dt>Nucleus ID</dt><dd>#{nucleus.id}</dd>
        <dt>Confidence</dt><dd>{fmtConf(nucleus.type_prob)}</dd>
        <dt>Area</dt><dd>{fmtNum(nucleus.area, 1)} px²</dd>
        <dt>Circularity</dt><dd>{fmtNum(nucleus.circularity, 3)}</dd>
        <dt>Aspect ratio</dt><dd>{fmtNum(nucleus.aspect_ratio, 3)}</dd>
        <dt>Centroid</dt><dd>({fmtNum(nucleus.centroid?.[1], 0)}, {fmtNum(nucleus.centroid?.[0], 0)})</dd>
      </dl>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiAnalysisPanel({
  slide,
  roiRect,          // { x, y, width, height } in image coords – null if not selected
  onAnalysisReady,  // callback(analysis) — called when a result arrives
  onError,
}) {
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [analyses, setAnalyses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);   // full analysis record
  const [hiddenClasses, setHiddenClasses] = useState(new Set());
  const [selectedNucleus, setSelectedNucleus] = useState(null);
  const abortRef = useRef(null);

  // ── Load analysis history on mount / slide change ───────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const list = await viewerService.getAiAnalyses(slide.id);
      setAnalyses(list);
      if (list.length > 0 && selectedId == null) {
        const latest = list[0];
        setSelectedId(latest.id);
        setDetail(latest);
        onAnalysisReady?.(latest);
      }
    } catch {
      /* history unavailable — non-fatal */
    }
  }, [slide.id, onAnalysisReady, selectedId]);

  useEffect(() => {
    setAnalyses([]);
    setSelectedId(null);
    setDetail(null);
    setSelectedNucleus(null);
    loadHistory();
  }, [slide.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run AI analysis ───────────────────────────────────────────────────────
  const runAnalysis = useCallback(async (autoTissue = false) => {
    if (running) return;
    setRunning(true);
    setSelectedNucleus(null);

    abortRef.current = new AbortController();
    const payload = autoTissue
      ? { auto_tissue: true }
      : roiRect
        ? { roi_x: Math.round(roiRect.x), roi_y: Math.round(roiRect.y), roi_width: Math.round(roiRect.width), roi_height: Math.round(roiRect.height) }
        : { auto_tissue: true };

    try {
      const result = await viewerService.runAiAnalysis(slide.id, payload, abortRef.current.signal);
      setDetail(result);
      setSelectedId(result.id);
      setAnalyses((prev) => [result, ...prev.filter((a) => a.id !== result.id)]);
      onAnalysisReady?.(result);
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(`AI analysis failed: ${err.message}`);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [running, roiRect, slide.id, onAnalysisReady, onError]);

  // ── Switch to a past analysis ─────────────────────────────────────────────
  const selectAnalysis = useCallback(async (id) => {
    if (!id) return;
    setSelectedId(Number(id));
    setSelectedNucleus(null);
    const cached = analyses.find((a) => a.id === Number(id));
    if (cached?.nuclei) {
      setDetail(cached);
      onAnalysisReady?.(cached);
      return;
    }
    try {
      const rec = await viewerService.getAiAnalysis(Number(id));
      setDetail(rec);
      setAnalyses((prev) => prev.map((a) => a.id === rec.id ? rec : a));
      onAnalysisReady?.(rec);
    } catch (err) {
      onError?.(`Could not load analysis: ${err.message}`);
    }
  }, [analyses, onAnalysisReady, onError]);

  const toggleClass = useCallback((key) => {
    setHiddenClasses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const breakdown = detail?.classification_breakdown ?? null;
  const morphology = detail?.morphology ?? null;
  const density = detail?.nuclear_density ?? null;
  const confidence = detail?.confidence_summary ?? null;
  const totalNuclei = detail?.total_nuclei ?? 0;
  const hasResults = detail && (detail.status === 'completed' || totalNuclei > 0);

  return (
    <section className="ai-panel" aria-label="HoVer-Net AI analysis">

      {/* ── Header / toggle ───────────────────────────────────────── */}
      <div
        className="ai-panel-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((v) => !v)}
      >
        <div className="ai-panel-header-left">
          <Activity size={15} aria-hidden="true" />
          <div>
            <p className="ai-panel-title">AI Nucleus Analysis</p>
            {hasResults && (
              <p className="ai-panel-subtitle">{totalNuclei} nuclei · HoVer-Net Fast</p>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`ai-panel-chevron${open ? ' ai-panel-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </div>

      {open && (
        <>
          {/* ── Research-use disclaimer ───────────────────────────── */}
          <p className="ai-disclaimer" role="note">
            <AlertTriangle size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Research Use Only — Not for Clinical Diagnosis
          </p>

          {/* ── Status ───────────────────────────────────────────── */}
          {running && (
            <div className="ai-status-row" role="status" aria-live="polite">
              <span className="ai-status-dot ai-status-dot--running" aria-hidden="true" />
              <Loader2 size={12} className="spin" aria-hidden="true" />
              Running HoVer-Net inference…
            </div>
          )}

          {/* ── Run buttons ───────────────────────────────────────── */}
          {!running && (
            <div className="ai-actions">
              {roiRect ? (
                <button
                  id="ai-run-roi-btn"
                  type="button"
                  className="ai-action-btn"
                  onClick={() => runAnalysis(false)}
                  aria-label="Analyze selected ROI with HoVer-Net"
                >
                  <Play size={14} aria-hidden="true" />
                  Analyze Selected ROI
                </button>
              ) : (
                <p className="ai-roi-prompt">
                  Draw a rectangle annotation to define an ROI, or use auto-detect.
                </p>
              )}
              <button
                id="ai-auto-detect-btn"
                type="button"
                className="ai-action-btn ai-action-btn--secondary"
                onClick={() => runAnalysis(true)}
                aria-label="Auto-detect tissue and analyze with HoVer-Net"
              >
                <Zap size={14} aria-hidden="true" />
                Auto-Detect &amp; Analyze
              </button>
            </div>
          )}

          {/* ── Summary stats ─────────────────────────────────────── */}
          {hasResults && !running && (
            <>
              <div className="ai-stats-grid">
                <div className="ai-stat-card">
                  <span className="ai-stat-value">{totalNuclei}</span>
                  <span className="ai-stat-label">Total nuclei</span>
                </div>
                <div className="ai-stat-card">
                  <span className="ai-stat-value">{fmtDensity(density)}</span>
                  <span className="ai-stat-label">Density</span>
                </div>
                {confidence && (
                  <>
                    <div className="ai-stat-card">
                      <span className="ai-stat-value">{fmtConf(confidence.mean)}</span>
                      <span className="ai-stat-label">Mean conf.</span>
                    </div>
                    <div className="ai-stat-card">
                      <span className="ai-stat-value">{fmtConf(confidence.median)}</span>
                      <span className="ai-stat-label">Median conf.</span>
                    </div>
                  </>
                )}
              </div>

              {/* ── Overlay image preview ─────────────────────────── */}
              <img
                className="ai-overlay-preview"
                src={viewerService.aiOverlayImageUrl(detail.id)}
                alt="AI nucleus overlay preview"
                crossOrigin="use-credentials"
                title="Click to pan to this region"
              />

              {/* ── Class breakdown table ─────────────────────────── */}
              <ClassTable
                breakdown={breakdown}
                totalNuclei={totalNuclei}
                hiddenClasses={hiddenClasses}
                onToggleClass={toggleClass}
              />

              {/* ── Morphology metrics ────────────────────────────── */}
              <MorphologyMetrics morphology={morphology} density={density} />

              {/* ── Selected nucleus detail ───────────────────────── */}
              {selectedNucleus && (
                <NucleusDetail
                  nucleus={selectedNucleus}
                  onClose={() => setSelectedNucleus(null)}
                />
              )}

              {/* ── PDF download ──────────────────────────────────── */}
              <a
                id="ai-pdf-download-btn"
                href={viewerService.aiReportPdfUrl(detail.id)}
                className="ai-pdf-btn"
                download
                aria-label="Download AI analysis PDF report"
              >
                <Download size={14} aria-hidden="true" />
                Download AI PDF Report
              </a>

              {/* ── Model info ────────────────────────────────────── */}
              <div className="ai-model-info">
                HoVer-Net Fast · PanNuke weights · 256 × 256 patch
                {detail.created_at && ` · ${new Date(detail.created_at).toLocaleString()}`}
              </div>
            </>
          )}

          {/* ── History switcher ──────────────────────────────────── */}
          {analyses.length > 1 && !running && (
            <div className="ai-history-section">
              <h4>
                <RefreshCw size={12} aria-hidden="true" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Past analyses
              </h4>
              <select
                id="ai-history-select"
                className="ai-history-select"
                value={selectedId ?? ''}
                onChange={(e) => selectAnalysis(e.target.value)}
                aria-label="Select past AI analysis"
              >
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.total_nuclei ?? '?'} nuclei · {a.created_at ? new Date(a.created_at).toLocaleString() : `#${a.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </section>
  );
}
