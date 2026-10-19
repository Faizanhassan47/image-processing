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
  Loader2, Play, RefreshCw, StopCircle, X, Zap
} from 'lucide-react';
import { viewerService } from '../../services/viewerService';
import './AiAnalysisPanel.css';

function formatDuration(sec) {
  if (sec == null || isNaN(sec) || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

function calcHovernetPatches(w, h) {
  if (!w || !h || w <= 0 || h <= 0) return 0;
  const nw = Math.max(1, Math.ceil((w - 164) / 164) + 1);
  const nh = Math.max(1, Math.ceil((h - 164) / 164) + 1);
  return nw * nh;
}

// ── PanNuke 6-class colour palette ──────────────────────────────────────────
// ── PanNuke 6-class colour palette (synchronized with Project A HoVer-Net) ──
export const PANNUKE_CLASSES = [
  { key: 'Neoplastic',    label: 'Neoplastic',     color: '#E53935', typeId: 1 },
  { key: 'Inflammatory',  label: 'Inflammatory',   color: '#FFB400', typeId: 2 },
  { key: 'Connective',    label: 'Connective',     color: '#28A745', typeId: 3 },
  { key: 'Necrotic',      label: 'Necrotic',       color: '#BA55D3', typeId: 4 },
  { key: 'Non-neoplastic',label: 'Non-neoplastic', color: '#009AD6', typeId: 5 },
  { key: 'No label',      label: 'No label',       color: '#B4B4B4', typeId: 0 },
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
            const count = breakdown[key] ?? breakdown[label] ?? (key === 'Necrotic' ? (breakdown['Dead'] ?? 0) : 0) ?? (key === 'Non-neoplastic' ? (breakdown['Epithelial'] ?? 0) : 0) ?? (key === 'No label' ? (breakdown['No Label'] ?? 0) : 0) ?? 0;
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
    { label: 'Median area',        value: `${fmtNum(morphology.area_median ?? morphology.median_area_pixels)} px²` },
    { label: 'Median perimeter',   value: `${fmtNum(morphology.perimeter_median ?? morphology.mean_perimeter_pixels)} px` },
    { label: 'Median circularity', value: fmtNum(morphology.circularity_median ?? morphology.mean_circularity, 3) },
    { label: 'Median aspect ratio',value: fmtNum(morphology.aspect_ratio_median ?? morphology.mean_aspect_ratio, 3) },
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
  const cls = PANNUKE_CLASSES.find((c) => c.key === nucleus.type || c.typeId === nucleus.type_id || c.label === nucleus.type) || { color: nucleus.color || '#94a3b8', label: nucleus.type };
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
        <dt>Centroid</dt><dd>({fmtNum(nucleus.centroid?.[0], 0)}, {fmtNum(nucleus.centroid?.[1], 0)})</dd>
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
  hiddenClasses: externalHiddenClasses,
  onToggleClass: externalOnToggleClass,
  selectedNucleus: externalSelectedNucleus,
  onSelectNucleus: externalOnSelectNucleus,
  onPanToRoi,
}) {
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [analyses, setAnalyses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);   // full analysis record
  const [internalHiddenClasses, setInternalHiddenClasses] = useState(new Set());
  const [internalSelectedNucleus, setInternalSelectedNucleus] = useState(null);
  const abortRef = useRef(null);
  const pollTimerRef = useRef(null);

  const hiddenClasses = externalHiddenClasses ?? internalHiddenClasses;
  const selectedNucleus = externalSelectedNucleus !== undefined ? externalSelectedNucleus : internalSelectedNucleus;

  const setSelectedNucleus = useCallback((nuc) => {
    setInternalSelectedNucleus(nuc);
    externalOnSelectNucleus?.(nuc);
  }, [externalOnSelectNucleus]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      if (abortRef.current) abortRef.current.abort();
    };
  }, [stopPolling]);

  // ── Load analysis history on mount / slide change ───────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const list = await viewerService.getAiAnalyses(slide.id);
      setAnalyses(list);
    } catch {
      /* history unavailable — non-fatal */
    }
  }, [slide.id]);

  useEffect(() => {
    stopPolling();
    if (abortRef.current) abortRef.current.abort();
    setRunning(false);
    setActiveJob(null);
    setAnalyses([]);
    setSelectedId(null);
    setDetail(null);
    setSelectedNucleus(null);
    loadHistory();
  }, [slide.id, stopPolling, loadHistory]);

  const startPollingJob = useCallback((jobId) => {
    stopPolling();
    const poll = async () => {
      try {
        const job = await viewerService.getAiJobStatus(jobId);
        setActiveJob(job);
        if (job.status === 'completed') {
          stopPolling();
          setRunning(false);
          setActiveJob(null);
          const result = job.result;
          if (result) {
            setDetail(result);
            setSelectedId(result.id);
            setAnalyses((prev) => [result, ...prev.filter((a) => a.id !== result.id)]);
            onAnalysisReady?.(result);
            if (result.roi) onPanToRoi?.(result.roi);
          }
        } else if (job.status === 'failed') {
          stopPolling();
          setRunning(false);
          setActiveJob(null);
          onError?.(job.error || 'AI analysis failed');
        } else if (job.status === 'cancelled') {
          stopPolling();
          setRunning(false);
          setActiveJob(null);
          onError?.('AI analysis was cancelled.');
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    };

    pollTimerRef.current = setInterval(poll, 1000);
    poll();
  }, [onAnalysisReady, onError, onPanToRoi, stopPolling]);

  const handleCancelJob = useCallback(async () => {
    if (activeJob?.id || activeJob?.job_id) {
      const jid = activeJob.id || activeJob.job_id;
      setCancelling(true);
      try {
        await viewerService.cancelAiJob(jid);
      } catch (err) {
        console.warn('Cancel failed:', err);
      } finally {
        setCancelling(false);
        stopPolling();
        setRunning(false);
        setActiveJob(null);
      }
    } else {
      if (abortRef.current) abortRef.current.abort();
      setRunning(false);
    }
  }, [activeJob, stopPolling]);

  // ── Run AI analysis ───────────────────────────────────────────────────────
  const runAnalysis = useCallback(async (autoTissue = false) => {
    if (running) return;
    setRunning(true);
    setActiveJob(null);
    setSelectedNucleus(null);
    // Clear previously displayed analysis immediately so old contours are not mistaken for the new run
    onAnalysisReady?.(null);
    setDetail(null);

    abortRef.current = new AbortController();
    const payload = autoTissue
      ? { auto_tissue: true }
      : roiRect
        ? {
            x: Math.round(roiRect.x),
            y: Math.round(roiRect.y),
            width: Math.round(roiRect.width),
            height: Math.round(roiRect.height),
            roi_x: Math.round(roiRect.x),
            roi_y: Math.round(roiRect.y),
            roi_width: Math.round(roiRect.width),
            roi_height: Math.round(roiRect.height),
          }
        : { auto_tissue: true };

    try {
      const result = await viewerService.runAiAnalysis(slide.id, payload, abortRef.current.signal);
      if (result && result.job_id && (result.status === 'processing' || result.status === 'queued')) {
        // Dispatched as background job (large ROI)
        setActiveJob({
          id: result.job_id,
          job_id: result.job_id,
          status: result.status,
          progress: result.progress || {
            current: 0,
            total: result.estimated_patches || 0,
            percentage: 0,
            elapsed_seconds: 0,
            remaining_seconds: result.estimated_duration_seconds || null,
            stage: 'Started inference worker...',
          },
        });
        startPollingJob(result.job_id);
      } else if (result) {
        // Completed synchronously (small ROI)
        setDetail(result);
        setSelectedId(result.id);
        setAnalyses((prev) => [result, ...prev.filter((a) => a.id !== result.id)]);
        onAnalysisReady?.(result);
        if (result.roi) onPanToRoi?.(result.roi);
        setRunning(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(`AI analysis failed: ${err.message}`);
      setRunning(false);
    } finally {
      abortRef.current = null;
    }
  }, [running, roiRect, slide.id, onAnalysisReady, onError, onPanToRoi, startPollingJob]);

  // ── PDF actions ───────────────────────────────────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    if (!detail?.id || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await viewerService.downloadAiReportPdf(detail.id);
    } catch (err) {
      onError?.(`PDF download failed: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  }, [detail?.id, downloadingPdf, onError]);

  const handleGenerateReport = useCallback(async () => {
    if (!detail?.id || generatingReport) return;
    setGeneratingReport(true);
    try {
      const res = await viewerService.generateAiReport(detail.id);
      if (res?.report_url) {
        setDetail((prev) => ({ ...prev, report_url: res.report_url }));
      }
      await viewerService.downloadAiReportPdf(detail.id);
    } catch (err) {
      onError?.(`Report generation failed: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  }, [detail?.id, generatingReport, onError]);

  // ── Switch to a past analysis ─────────────────────────────────────────────
  const selectAnalysis = useCallback(async (id) => {
    if (!id) {
      setSelectedId(null);
      setDetail(null);
      setSelectedNucleus(null);
      onAnalysisReady?.(null);
      return;
    }
    setSelectedId(Number(id));
    setSelectedNucleus(null);
    const cached = analyses.find((a) => a.id === Number(id));
    if (cached?.nuclei) {
      setDetail(cached);
      onAnalysisReady?.(cached);
      if (cached.roi) onPanToRoi?.(cached.roi);
      return;
    }
    try {
      const rec = await viewerService.getAiAnalysis(Number(id));
      setDetail(rec);
      setAnalyses((prev) => prev.map((a) => a.id === rec.id ? rec : a));
      onAnalysisReady?.(rec);
      if (rec.roi) onPanToRoi?.(rec.roi);
    } catch (err) {
      onError?.(`Could not load analysis: ${err.message}`);
    }
  }, [analyses, onAnalysisReady, onError, onPanToRoi]);

  const toggleClass = useCallback((key) => {
    if (externalOnToggleClass) {
      externalOnToggleClass(key);
    } else {
      setInternalHiddenClasses((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }
  }, [externalOnToggleClass]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const breakdown = detail?.classification_breakdown ?? detail?.analysis?.classification_breakdown ?? null;
  const morphology = detail?.morphology ?? detail?.analysis?.morphology ?? null;
  const density = detail?.nuclear_density ?? detail?.analysis?.nuclear_density_per_mm2 ?? null;
  const confidence = detail?.confidence_summary ?? (detail?.confidence_statistics?.overall) ?? null;
  const totalNuclei = detail?.total_nuclei ?? detail?.analysis?.total_nuclei ?? detail?.counts?.total ?? 0;
  const hasResults = Boolean(detail && (totalNuclei > 0 || detail.status?.toLowerCase() === 'completed'));
  const elapsedSec = detail?.elapsed_seconds ?? detail?.inference_duration ?? null;

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

          {/* ── Status / Progress ───────────────────────────────── */}
          {running && (
            <div className="ai-progress-card" role="status" aria-live="polite">
              <div className="ai-progress-header">
                <div className="ai-progress-title-row">
                  <Loader2 size={13} className="spin ai-progress-spinner" aria-hidden="true" />
                  <span className="ai-progress-stage">
                    {activeJob?.progress?.stage || 'Running HoVer-Net inference…'}
                  </span>
                </div>
                <button
                  id="ai-cancel-job-btn"
                  type="button"
                  className="ai-progress-cancel-btn"
                  onClick={handleCancelJob}
                  disabled={cancelling}
                  title="Cancel AI analysis"
                  aria-label="Cancel AI analysis"
                >
                  <StopCircle size={13} aria-hidden="true" />
                  <span>{cancelling ? 'Cancelling…' : 'Cancel'}</span>
                </button>
              </div>

              {activeJob?.progress && (
                <>
                  <div className="ai-progress-bar-track" aria-hidden="true">
                    <div
                      className="ai-progress-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, activeJob.progress.percentage || 0))}%` }}
                    />
                  </div>

                  <div className="ai-progress-metrics">
                    <span className="ai-progress-patches">
                      {activeJob.progress.total > 0
                        ? `Patches: ${activeJob.progress.current} / ${activeJob.progress.total} (${activeJob.progress.percentage || 0}%)`
                        : 'Starting patch pipeline…'}
                    </span>
                    <span className="ai-progress-times">
                      {activeJob.progress.elapsed_seconds != null && (
                        <span>Elapsed: {formatDuration(activeJob.progress.elapsed_seconds)}</span>
                      )}
                      {activeJob.progress.remaining_seconds != null && activeJob.progress.remaining_seconds > 0 && (
                        <span> · Rem: ~{formatDuration(activeJob.progress.remaining_seconds)}</span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Run buttons ───────────────────────────────────────── */}
          {!running && (
            <div className="ai-actions">
              {roiRect ? (() => {
                const w = Math.round(roiRect.width);
                const h = Math.round(roiRect.height);
                const patches = calcHovernetPatches(w, h);
                const isTooLarge = w > 8192 || h > 8192;
                const isTooSmall = w < 32 || h < 32;
                const isLargeJob = patches > 25;
                const estSec = Math.round(patches * 2.8);

                return (
                  <>
                    <div className={`ai-roi-badge${isTooLarge || isTooSmall ? ' ai-roi-badge--warning' : ''}`} role="status">
                      <div className="ai-roi-badge-title">
                        <span>Target: {roiRect.label || 'Selected Region'}</span>
                        <span>{w} × {h} px</span>
                      </div>
                      <div className="ai-roi-badge-coords">
                        Level-0 coordinates: ({Math.round(roiRect.x)}, {Math.round(roiRect.y)})
                      </div>
                      <div className="ai-roi-badge-meta">
                        <span className="ai-roi-badge-patches">
                          {patches} {patches === 1 ? 'patch' : 'patches'}
                        </span>
                        <span className="ai-roi-badge-time">
                          ~{formatDuration(estSec)} ({isLargeJob ? 'Background Job' : 'Fast Analysis'})
                        </span>
                      </div>
                      {isTooLarge && (
                        <div className="ai-roi-badge-error">
                          ROI exceeds maximum dimension of 8,192 px. Please crop a smaller region.
                        </div>
                      )}
                      {isTooSmall && (
                        <div className="ai-roi-badge-error">
                          ROI is smaller than minimum dimension of 32 px.
                        </div>
                      )}
                    </div>
                    <button
                      id="ai-run-roi-btn"
                      type="button"
                      className="ai-action-btn"
                      onClick={() => runAnalysis(false)}
                      disabled={isTooLarge || isTooSmall}
                      aria-label="Analyze selected ROI with HoVer-Net"
                    >
                      <Play size={14} aria-hidden="true" />
                      Analyze Selected ROI
                    </button>
                  </>
                );
              })() : (
                <p className="ai-roi-prompt">
                  Draw a rectangle annotation or select one to define an ROI.
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
              <div className="ai-panel-roi-header">
                <span className="ai-panel-subtitle">
                  {detail.roi ? `ROI: (${detail.roi.x}, ${detail.roi.y}) · ${detail.roi.width}×${detail.roi.height} px` : `Analysis #${detail.id}`}
                </span>
                <button
                  type="button"
                  className="ai-clear-btn"
                  onClick={() => {
                    onAnalysisReady?.(null);
                    setDetail(null);
                    setSelectedId(null);
                    setSelectedNucleus(null);
                  }}
                  title="Hide AI overlay"
                >
                  Clear overlay
                </button>
              </div>

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
                {elapsedSec != null && (
                  <div className="ai-stat-card">
                    <span className="ai-stat-value">{elapsedSec}s</span>
                    <span className="ai-stat-label">Inference time</span>
                  </div>
                )}
              </div>

              {/* ── Overlay image preview ─────────────────────────── */}
              <img
                className="ai-overlay-preview"
                src={viewerService.aiOverlayImageUrl(detail.id)}
                alt="AI nucleus overlay preview"
                crossOrigin="use-credentials"
                title="Click to zoom to analyzed ROI"
                onClick={() => {
                  if (detail.roi) onPanToRoi?.(detail.roi);
                }}
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

              {/* ── PDF download and report actions ─────────────────── */}
              <div className="ai-actions ai-actions--reports">
                <button
                  id="ai-pdf-download-btn"
                  type="button"
                  className="ai-pdf-btn ai-pdf-btn--full"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  aria-label="Download AI analysis PDF report"
                >
                  {downloadingPdf ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                  {downloadingPdf ? 'Downloading PDF…' : 'Download AI PDF'}
                </button>
                <button
                  id="ai-generate-report-btn"
                  type="button"
                  className="ai-action-btn ai-action-btn--secondary"
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  aria-label="Generate fresh AI report"
                >
                  {generatingReport ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
                  {generatingReport ? 'Generating…' : 'Generate AI Report'}
                </button>
              </div>

              {/* ── Model info ────────────────────────────────────── */}
              <div className="ai-model-info">
                HoVer-Net Fast · PanNuke weights · 256 × 256 patch
                {elapsedSec != null && ` · ${elapsedSec}s`}
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
