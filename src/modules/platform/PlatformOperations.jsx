import { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, DatabaseBackup, HardDrive, RefreshCw, ServerCog, Waypoints } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { platformService } from '../../services/platformService';
import './PlatformOperations.css';

const emptyData = { ingestion: [], models: [], jobs: [], hl7: [], compatibility: [], backups: [] };

function Status({ value }) { return <span className={`ops-status ops-status--${String(value).toLowerCase()}`}>{value}</span>; }

export default function PlatformOperations() {
  const [health, setHealth] = useState(null);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [nextHealth, ingestion, models, jobs, hl7, compatibility, backups] = await Promise.all([
        platformService.health(signal), platformService.ingestionJobs(signal), platformService.aiModels(signal),
        platformService.aiJobs(signal), platformService.hl7Events(signal), platformService.compatibility(signal), platformService.backups(signal),
      ]);
      setHealth(nextHealth); setData({ ingestion, models, jobs, hl7, compatibility, backups });
    } catch (error) { if (error.name !== 'AbortError') toast.error(error.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) load(controller.signal); }); return () => controller.abort(); }, [load]);
  const action = async (work, message) => { try { await work(); toast.success(message); await load(); } catch (error) { toast.error(error.message); } };

  return <main id="main-content" className="ops-page">
    <div className="ops-heading"><div><p className="page-eyebrow">Platform administration</p><h1>Operations control center</h1><p>Monitor software ingestion, integrations, AI jobs, storage, and backups.</p></div><div className="ops-heading-actions"><Link to="/" className="btn-control-secondary route-link">Back to workspace</Link><Link to="/admin" className="btn-control-secondary route-link">Users</Link><button className="btn-control-secondary" onClick={() => load()} disabled={loading}><RefreshCw size={16} /> Refresh</button></div></div>
    <section className="ops-metrics" aria-label="System health">
      <article><Activity /><div><span>Database</span><strong>{health?.database?.ok ? 'Available' : 'Unavailable'}</strong></div></article>
      <article><HardDrive /><div><span>Storage used</span><strong>{health ? `${health.storage.used_percent}%` : '--'}</strong></div></article>
      <article><ServerCog /><div><span>Ingestion queue</span><strong>{data.ingestion.filter((item) => item.status === 'Queued').length}</strong></div></article>
      <article><Bot /><div><span>AI jobs</span><strong>{data.jobs.length}</strong></div></article>
    </section>
    {loading ? <div className="ops-loading"><span className="loading-spinner" /> Loading operational data...</div> : <div className="ops-grid">
      <section className="ops-card ops-card--wide"><header><div><h2>Image ingestion</h2><p>Queued files, retries, duplicate checks, and quarantine state.</p></div></header><div className="ops-table-wrap"><table><thead><tr><th>File</th><th>Adapter</th><th>Status</th><th>Progress</th><th>Action</th></tr></thead><tbody>{data.ingestion.length ? data.ingestion.map((item) => <tr key={item.id}><td>{item.original_filename}</td><td>{item.adapter_name}</td><td><Status value={item.status} /></td><td>{item.progress}%</td><td>{item.status === 'Queued' && <button onClick={() => action(() => platformService.processIngestion(item.id), 'Ingestion completed')}>Process</button>}{['Failed','Quarantined','Cancelled'].includes(item.status) && <button onClick={() => action(() => platformService.retryIngestion(item.id), 'Job queued')}>Retry</button>}</td></tr>) : <tr><td colSpan="5" className="ops-empty">No ingestion jobs.</td></tr>}</tbody></table></div></section>
      <section className="ops-card"><header><Waypoints /><div><h2>HL7 interface</h2><p>{data.hl7.length} recorded events</p></div></header>{data.hl7.slice(0,5).map((item) => <div className="ops-row" key={item.id}><span>{item.message_type || 'Unknown'}</span><Status value={item.status} /><button onClick={() => action(() => platformService.replayHl7(item.id), 'Event queued for replay')}>Replay</button></div>)}{!data.hl7.length && <p className="ops-empty">No interface events.</p>}</section>
      <section className="ops-card"><header><Bot /><div><h2>AI registry</h2><p>Research and validated model inventory</p></div></header>{data.models.slice(0,6).map((item) => <div className="ops-row" key={item.id}><span>{item.name} <small>{item.version}</small></span><Status value={item.approval_status} /></div>)}{!data.models.length && <p className="ops-empty">No models registered.</p>}</section>
      <section className="ops-card"><header><DatabaseBackup /><div><h2>SQL backups</h2><p>Native COPY_ONLY backup history</p></div><button onClick={() => action(() => platformService.createBackup(), 'Backup completed')}>Run backup</button></header>{data.backups.slice(0,5).map((item) => <div className="ops-row" key={item.id}><span>{item.started_at}</span><Status value={item.status} /></div>)}{!data.backups.length && <p className="ops-empty">No backup runs.</p>}</section>
      <section className="ops-card"><header><HardDrive /><div><h2>Scanner compatibility</h2><p>Evidence-based compatibility matrix</p></div></header>{data.compatibility.slice(0,6).map((item) => <div className="ops-row" key={item.id}><span>{item.manufacturer} {item.model} <small>{item.format}</small></span><Status value={item.validation_status} /></div>)}{!data.compatibility.length && <p className="ops-empty">No scanner has been validated.</p>}</section>
    </div>}
  </main>;
}
