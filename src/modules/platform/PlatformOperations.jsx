import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Bot, CheckCircle, Clock, DatabaseBackup,
  FileImage, HardDrive, RefreshCw, ServerCog, ShieldAlert, Waypoints,
  Sliders, Layers, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { platformService } from '../../services/platformService';
import './PlatformOperations.css';

const emptyData = {
  ingestion: [],
  reconciliation: [],
  models: [],
  jobs: [],
  hl7: [],
  compatibility: [],
  backups: [],
  metrics: null,
};

function Status({ value }) {
  return <span className={`ops-status ops-status--${String(value).toLowerCase()}`}>{value}</span>;
}

function ValidationSummary({ validation }) {
  if (!validation) return <span className="ops-muted">Pending</span>;
  if (!validation.valid) return <span className="ops-validation-error">Validation failed</span>;
  const calibration = validation.physical_calibration?.available ? 'Calibrated' : 'No calibration';
  return (
    <span className="ops-validation-summary">
      <strong>{validation.format}</strong>
      <small>{validation.width} × {validation.height} · {validation.level_count} level{validation.level_count === 1 ? '' : 's'} · {calibration}</small>
    </span>
  );
}

export default function PlatformOperations() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'queue', 'ingestion', 'matrix', 'system'
  const [health, setHealth] = useState(null);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);

  // Ingestion search/filter state
  const [ingestionFilter, setIngestionFilter] = useState('All');
  const [ingestionSearch, setIngestionSearch] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState([]);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [nextHealth, metrics, ingestion, reconciliation, models, jobs, hl7, compatibility, backups] = await Promise.all([
        platformService.health(signal).catch(() => null),
        platformService.dashboardMetrics(signal).catch(() => null),
        platformService.ingestionJobs(signal).catch(() => []),
        platformService.reconciliationItems(signal).catch(() => []),
        platformService.aiModels(signal).catch(() => []),
        platformService.aiJobs(signal).catch(() => []),
        platformService.hl7Events(signal).catch(() => []),
        platformService.compatibility(signal).catch(() => []),
        platformService.backups(signal).catch(() => []),
      ]);
      setHealth(nextHealth);
      setData({
        ingestion: ingestion || [],
        reconciliation: reconciliation || [],
        models: models || [],
        jobs: jobs || [],
        hl7: hl7 || [],
        compatibility: compatibility || [],
        backups: backups || [],
        metrics,
      });
    } catch (error) {
      if (error.name !== 'AbortError') toast.error(error.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const action = async (work, message) => {
    try {
      await work();
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleBatch = async (batchAction) => {
    if (!selectedJobIds.length) {
      toast.error('Select at least one job first.');
      return;
    }
    try {
      await platformService.batchIngestion(batchAction, selectedJobIds);
      toast.success(`Batch ${batchAction} executed on ${selectedJobIds.length} item(s).`);
      setSelectedJobIds([]);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleSelectJob = (id) => {
    setSelectedJobIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const filteredIngestion = data.ingestion.filter((job) => {
    const matchesFilter = ingestionFilter === 'All' || job.status === ingestionFilter;
    const matchesSearch = !ingestionSearch || job.original_filename?.toLowerCase().includes(ingestionSearch.toLowerCase()) || job.adapter_name?.toLowerCase().includes(ingestionSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const m = data.metrics || {};

  return (
    <main id="main-content" className="ops-page">
      <div className="ops-heading">
        <div>
          <p className="page-eyebrow">Laboratory & System Operations</p>
          <h1>Operations Control Center</h1>
          <p>Real-time laboratory queues, turnaround metrics, WSI ingestion, and system administration.</p>
        </div>
        <div className="ops-heading-actions">
          <Link to="/" className="btn-control-secondary route-link">Workspace</Link>
          <Link to="/patients" className="btn-control-secondary route-link">Patients</Link>
          <button className="btn-control-secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <nav className="ops-nav-tabs" role="tablist" aria-label="Operations views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`ops-nav-tab ${activeTab === 'overview' ? 'ops-nav-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={15} /> Dashboard & TAT
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'queue'}
          className={`ops-nav-tab ${activeTab === 'queue' ? 'ops-nav-tab--active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Layers size={15} /> Work Queue
          {m.cases?.unassigned > 0 && <span className="badge-counter">{m.cases.unassigned}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ingestion'}
          className={`ops-nav-tab ${activeTab === 'ingestion' ? 'ops-nav-tab--active' : ''}`}
          onClick={() => setActiveTab('ingestion')}
        >
          <FileImage size={15} /> Image Ingestion
          {data.ingestion.filter(j => ['Failed', 'Quarantined'].includes(j.status)).length > 0 && (
            <span className="badge-counter" style={{ color: 'var(--color-danger)' }}>
              {data.ingestion.filter(j => ['Failed', 'Quarantined'].includes(j.status)).length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'matrix'}
          className={`ops-nav-tab ${activeTab === 'matrix' ? 'ops-nav-tab--active' : ''}`}
          onClick={() => setActiveTab('matrix')}
        >
          <Sliders size={15} /> Scanner Compatibility
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'system'}
          className={`ops-nav-tab ${activeTab === 'system' ? 'ops-nav-tab--active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <HardDrive size={15} /> System Health & Backups
        </button>
      </nav>

      {/* Primary KPI Cards */}
      <section className="ops-metrics" aria-label="Operational KPI summary">
        <article>
          <Activity />
          <div>
            <span>Active Cases</span>
            <strong>{m.cases ? m.cases.new + m.cases.in_review : '--'}</strong>
            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
              {m.cases ? `${m.cases.unassigned} unassigned · ${m.cases.urgent} urgent` : ''}
            </small>
          </div>
        </article>
        <article>
          <Clock />
          <div>
            <span>Turnaround Time</span>
            <strong>{m.turnaround_time_hours ? `${m.turnaround_time_hours.overall_completion}h` : '--'}</strong>
            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>Avg registration to signoff</small>
          </div>
        </article>
        <article>
          <AlertTriangle color={m.slides?.qc_exceptions > 0 ? 'var(--color-danger)' : undefined} />
          <div>
            <span>QC Exceptions</span>
            <strong>{m.slides?.qc_exceptions ?? 0}</strong>
            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
              {m.slides?.qc_pending ?? 0} slides pending QC
            </small>
          </div>
        </article>
        <article>
          <ServerCog />
          <div>
            <span>Pending Reports</span>
            <strong>{m.reports?.pending_review ?? 0}</strong>
            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
              {m.reports?.approved ?? 0} approved to date
            </small>
          </div>
        </article>
      </section>

      {loading && <div className="ops-loading"><span className="loading-spinner" /> Loading operational records…</div>}

      {!loading && activeTab === 'overview' && (
        <div className="ops-grid">
          <section className="ops-card ops-card--wide">
            <header>
              <div>
                <h2>Turnaround Time (TAT) Stage Tracking</h2>
                <p>Calculated durations between clinical lifecycle stages from genuine audit timestamps.</p>
              </div>
            </header>
            <div className="tat-card-grid">
              <div className="tat-stat-card">
                <span>Registration to Reviewer Assignment</span>
                <strong>{m.turnaround_time_hours?.registration_to_assignment ?? 0} hrs</strong>
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Average intake processing speed</small>
              </div>
              <div className="tat-stat-card">
                <span>Assignment to Slide Review Active</span>
                <strong>{m.turnaround_time_hours?.assignment_to_review ?? 0} hrs</strong>
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Time before pathologist begins review</small>
              </div>
              <div className="tat-stat-card">
                <span>Overall Case Completion TAT</span>
                <strong>{m.turnaround_time_hours?.overall_completion ?? 0} hrs</strong>
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Registration through final report approval</small>
              </div>
            </div>

            <header style={{ marginTop: 'var(--spacing-md)' }}>
              <div>
                <h3>Pathologist Clinical Workload</h3>
                <p>Real-time active caseload per assigned pathologist.</p>
              </div>
            </header>
            <div className="ops-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pathologist</th>
                    <th>Active Cases</th>
                    <th>Urgent / Stat</th>
                    <th>Overdue Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {(m.pathologist_workload || []).map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.pathologist}</strong></td>
                      <td>{row.active_cases}</td>
                      <td>{row.urgent_cases > 0 ? <span style={{ color: 'var(--color-danger)' }}>{row.urgent_cases}</span> : 0}</td>
                      <td>{row.overdue_cases > 0 ? <span style={{ color: 'var(--color-danger)' }}>{row.overdue_cases}</span> : 0}</td>
                    </tr>
                  ))}
                  {!(m.pathologist_workload || []).length && (
                    <tr><td colSpan="4" className="ops-empty">No active assignments recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {!loading && activeTab === 'queue' && (
        <div className="ops-grid">
          <section className="ops-card ops-card--wide">
            <header>
              <div>
                <h2>Unified Laboratory Work Queue</h2>
                <p>Prioritized work items requiring action across intake, QC, and pathology review.</p>
              </div>
            </header>
            <div className="tat-card-grid">
              <div className="tat-stat-card">
                <span>Unassigned Cases</span>
                <strong>{m.cases?.unassigned ?? 0}</strong>
                <small style={{ color: 'var(--color-text-muted)' }}>Require pathologist assignment</small>
              </div>
              <div className="tat-stat-card">
                <span>Slides Needing Rescan</span>
                <strong style={{ color: 'var(--color-danger)' }}>{m.slides?.qc_exceptions ?? 0}</strong>
                <small style={{ color: 'var(--color-text-muted)' }}>QC rejected slides requiring technician action</small>
              </div>
              <div className="tat-stat-card">
                <span>Unreconciled Ingestion Files</span>
                <strong>{m.ingestion?.awaiting_reconciliation ?? 0}</strong>
                <small style={{ color: 'var(--color-text-muted)' }}>Images awaiting accession matching</small>
              </div>
            </div>

            {data.reconciliation.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <header>
                  <div>
                    <h3>Unreconciled Slide Queue</h3>
                    <p>WSI uploads with unmatched barcodes or patient identifiers.</p>
                  </div>
                </header>
                <div className="ops-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Proposed Case</th>
                        <th>Reason</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reconciliation.map((rec) => (
                        <tr key={rec.id}>
                          <td>#{rec.id}</td>
                          <td><strong>{rec.proposed_case_id || 'Unknown'}</strong></td>
                          <td>{rec.reason}</td>
                          <td>
                            <button
                              onClick={() => {
                                const targetId = window.prompt('Enter valid Case ID to associate:');
                                if (targetId) action(() => platformService.resolveReconciliation(rec.id, Number(targetId)), 'Reconciliation linked');
                              }}
                            >
                              Resolve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && activeTab === 'ingestion' && (
        <div className="ops-grid">
          <section className="ops-card ops-card--wide">
            <header>
              <div>
                <h2>Whole Slide Image (WSI) Import Management</h2>
                <p>Search, batch process, and review quarantined digital pathology slide uploads.</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginLeft: 'auto' }}>
                <button disabled={!selectedJobIds.length} onClick={() => handleBatch('retry')}>Batch Retry</button>
                <button disabled={!selectedJobIds.length} onClick={() => handleBatch('cancel')}>Batch Cancel</button>
              </div>
            </header>

            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search by filename or adapter…"
                value={ingestionSearch}
                onChange={(e) => setIngestionSearch(e.target.value)}
              />
              <select value={ingestionFilter} onChange={(e) => setIngestionFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Queued">Queued</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
                <option value="Quarantined">Quarantined</option>
                <option value="Failed">Failed</option>
                <option value="Duplicate">Duplicate</option>
              </select>
            </div>

            <div className="ops-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>
                      <input
                        type="checkbox"
                        checked={filteredIngestion.length > 0 && selectedJobIds.length === filteredIngestion.length}
                        onChange={(e) => setSelectedJobIds(e.target.checked ? filteredIngestion.map(j => j.id) : [])}
                      />
                    </th>
                    <th>File</th>
                    <th>Adapter</th>
                    <th>Status</th>
                    <th>Validation & Calibration</th>
                    <th>Progress</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngestion.length ? filteredIngestion.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedJobIds.includes(item.id)}
                          onChange={() => toggleSelectJob(item.id)}
                        />
                      </td>
                      <td>
                        <strong>{item.original_filename}</strong>
                        {item.match_identifier && <small style={{ display: 'block', color: 'var(--color-text-muted)' }}>ID: {item.match_identifier}</small>}
                      </td>
                      <td>{item.adapter_name}</td>
                      <td><Status value={item.status} /></td>
                      <td><ValidationSummary validation={item.validation} /></td>
                      <td>{item.progress}%</td>
                      <td>
                        {item.status === 'Queued' && (
                          <button onClick={() => action(() => platformService.processIngestion(item.id), 'Ingestion completed')}>
                            Process
                          </button>
                        )}
                        {['Failed', 'Quarantined', 'Cancelled'].includes(item.status) && (
                          <button onClick={() => action(() => platformService.retryIngestion(item.id), 'Job re-queued')}>
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" className="ops-empty">No ingestion jobs match criteria.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {!loading && activeTab === 'matrix' && (
        <div className="ops-grid">
          <section className="ops-card ops-card--wide">
            <header>
              <div>
                <h2>Scanner Compatibility Registry</h2>
                <p>Evidence-based verification matrix across pathology whole-slide scanners.</p>
              </div>
            </header>
            <div className="ops-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Software Version</th>
                    <th>Format</th>
                    <th>Import Method</th>
                    <th>Validation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.compatibility.length ? data.compatibility.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.manufacturer}</strong></td>
                      <td>{item.model}</td>
                      <td>{item.software_version || 'Any'}</td>
                      <td>{item.format}</td>
                      <td>{item.import_method}</td>
                      <td><Status value={item.validation_status} /></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="ops-empty">No validated scanners recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {!loading && activeTab === 'system' && (
        <div className="ops-grid">
          <section className="ops-card">
            <header>
              <HardDrive />
              <div>
                <h2>Storage Utilization</h2>
                <p>{health ? `${health.storage.path}` : 'Storage repository'}</p>
              </div>
            </header>
            <div style={{ padding: 'var(--spacing-md) 0' }}>
              <p>Capacity: <strong>{health ? `${health.storage.used_percent}% used` : '--'}</strong></p>
              <div style={{ height: '8px', background: 'var(--color-surface-elevated)', borderRadius: '4px', overflow: 'hidden', margin: '8px 0' }}>
                <div style={{ width: `${health?.storage?.used_percent || 0}%`, height: '100%', background: 'var(--color-primary)' }} />
              </div>
              <small style={{ color: 'var(--color-text-muted)' }}>
                {health ? `${(health.storage.free / (1024 * 1024 * 1024)).toFixed(1)} GB free of ${(health.storage.total / (1024 * 1024 * 1024)).toFixed(1)} GB` : ''}
              </small>
            </div>
          </section>

          <section className="ops-card">
            <header>
              <DatabaseBackup />
              <div>
                <h2>SQL Server Backups</h2>
                <p>Native transactionally-consistent COPY_ONLY snapshots.</p>
              </div>
              <button onClick={() => action(() => platformService.createBackup(), 'Native backup created')}>
                Create Backup
              </button>
            </header>
            {data.backups.slice(0, 5).map((item) => (
              <div className="ops-row" key={item.id}>
                <span>{item.destination ? item.destination.split('\\').pop() : 'Backup'}</span>
                <Status value={item.status} />
              </div>
            ))}
            {!data.backups.length && <p className="ops-empty">No backup history available.</p>}
          </section>

          <section className="ops-card">
            <header>
              <Waypoints />
              <div>
                <h2>LIS / HL7 Interface</h2>
                <p>{data.hl7.length} logged messages</p>
              </div>
            </header>
            {data.hl7.slice(0, 5).map((item) => (
              <div className="ops-row" key={item.id}>
                <span>{item.message_type || 'HL7 Message'}</span>
                <Status value={item.status} />
                <button onClick={() => action(() => platformService.replayHl7(item.id), 'Message replayed')}>Replay</button>
              </div>
            ))}
            {!data.hl7.length && <p className="ops-empty">No interface messages recorded.</p>}
          </section>

          <section className="ops-card">
            <header>
              <Bot />
              <div>
                <h2>AI Models & Jobs</h2>
                <p>Integrated pathology AI pipelines</p>
              </div>
            </header>
            {data.models.map((item) => (
              <div className="ops-row" key={item.id}>
                <span><strong>{item.name}</strong> <small>v{item.version}</small></span>
                <Status value={item.approval_status} />
              </div>
            ))}
            {!data.models.length && <p className="ops-empty">No AI models registered.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
