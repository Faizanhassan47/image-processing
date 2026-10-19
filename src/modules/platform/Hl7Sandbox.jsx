import { useEffect, useState } from 'react';
import { Play, CheckCircle2, AlertCircle, FileText, Send, RefreshCw, Terminal, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { platformService } from '../../services/platformService';
import './Hl7Sandbox.css';

export default function Hl7Sandbox({ onMessageProcessed }) {
  const [samples, setSamples] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('ORM_O01');
  const [rawPayload, setRawPayload] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    platformService.hl7Samples(ctrl.signal)
      .then((data) => {
        if (data) {
          setSamples(data);
          if (data.ORM_O01) setRawPayload(data.ORM_O01);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') toast.error('Failed to load sample HL7 templates');
      });
    return () => ctrl.abort();
  }, []);

  const handleSelectTemplate = (templateKey) => {
    setSelectedTemplate(templateKey);
    if (samples[templateKey]) {
      setRawPayload(samples[templateKey]);
      setValidationResult(null);
      setSimulationResult(null);
    }
  };

  const handleValidate = async () => {
    if (!rawPayload.trim()) {
      toast.error('Payload cannot be empty');
      return;
    }
    setBusy(true);
    try {
      const res = await platformService.validateHl7(rawPayload);
      setValidationResult(res);
      setSimulationResult(null);
      if (res.is_valid) {
        toast.success('HL7 structure and segments validated successfully!');
      } else {
        toast.error(`Validation found ${res.errors.length} issue(s)`);
      }
    } catch (err) {
      toast.error(err.message || 'Validation request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSimulate = async () => {
    if (!rawPayload.trim()) {
      toast.error('Payload cannot be empty');
      return;
    }
    setBusy(true);
    try {
      const res = await platformService.simulateHl7(rawPayload);
      setSimulationResult(res);
      toast.success(`HL7 Event #${res.event_id} processed into database!`);
      if (onMessageProcessed) onMessageProcessed();
    } catch (err) {
      toast.error(err.message || 'Simulation execution failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hl7-sandbox-container">
      <header className="hl7-sandbox-header">
        <div>
          <h2>HL7 v2 Message Sandbox & Test Harness</h2>
          <p>
            Interactive testing environment for Section 5.8 (INT-001 – INT-012). Test inbound ADT, ORM, and ORU message parsing,
            canonical entity extraction, ACK generation, and simulated accession/patient reconciliation.
          </p>
        </div>
      </header>

      <div className="hl7-sandbox-controls">
        <div className="hl7-template-picker">
          <label htmlFor="hl7-template-select">
            <FileText size={15} /> Select Preset Profile:
          </label>
          <select
            id="hl7-template-select"
            value={selectedTemplate}
            onChange={(e) => handleSelectTemplate(e.target.value)}
          >
            <option value="ADT_A01">ADT^A01 — Patient Admit / Registration</option>
            <option value="ORM_O01">ORM^O01 — Pathology Order / Accession Request</option>
            <option value="ORU_R01">ORU^R01 — Observation / Preliminary Findings</option>
          </select>
        </div>

        <div className="hl7-action-buttons">
          <button
            type="button"
            className="btn-control-secondary"
            onClick={handleValidate}
            disabled={busy}
          >
            <CheckCircle2 size={15} /> Validate Structure
          </button>
          <button
            type="button"
            className="btn-control-primary"
            onClick={handleSimulate}
            disabled={busy}
          >
            <Send size={15} /> Ingest & Simulate
          </button>
        </div>
      </div>

      <div className="hl7-editor-split">
        <div className="hl7-editor-panel">
          <label htmlFor="hl7-raw-editor" className="panel-label">
            <Terminal size={14} /> Pipe-Delimited HL7 v2 Message Payload:
          </label>
          <textarea
            id="hl7-raw-editor"
            className="hl7-raw-textarea"
            rows={10}
            value={rawPayload}
            onChange={(e) => setRawPayload(e.target.value)}
            placeholder="MSH|^~\&|..."
          />
        </div>

        <div className="hl7-result-panel">
          <label className="panel-label">
            <Layers size={14} /> Parsing & Reconciliation Inspection:
          </label>

          {validationResult && (
            <div className={`hl7-validation-card ${validationResult.is_valid ? 'valid' : 'invalid'}`}>
              <div className="card-header">
                {validationResult.is_valid ? (
                  <span className="badge-valid"><CheckCircle2 size={14} /> HL7 Structure Valid</span>
                ) : (
                  <span className="badge-invalid"><AlertCircle size={14} /> Validation Errors</span>
                )}
                <span className="message-type-tag">
                  Type: <strong>{validationResult.parsed?.message_type || 'Unknown'}</strong> (v{validationResult.parsed?.version})
                </span>
              </div>

              {!validationResult.is_valid && (
                <ul className="error-list">
                  {validationResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}

              {validationResult.canonical_entities && (
                <div className="canonical-entities">
                  <h4>Canonical Entity Mapping:</h4>
                  <div className="entity-tags">
                    {validationResult.canonical_entities.patient && (
                      <div className="entity-item">
                        <span>Patient (PID):</span>
                        <strong>
                          {validationResult.canonical_entities.patient.first_name} {validationResult.canonical_entities.patient.last_name}
                        </strong>
                        <small>MRN: {validationResult.canonical_entities.patient.medical_record_number || 'N/A'}</small>
                      </div>
                    )}
                    {validationResult.canonical_entities.order && (
                      <div className="entity-item">
                        <span>Accession / Order:</span>
                        <strong>{validationResult.canonical_entities.order.accession_number}</strong>
                        <small>Priority: {validationResult.canonical_entities.order.priority}</small>
                      </div>
                    )}
                    {validationResult.canonical_entities.observations?.length > 0 && (
                      <div className="entity-item">
                        <span>Observations:</span>
                        <strong>{validationResult.canonical_entities.observations.length} OBX segment(s)</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="ack-preview">
                <h4>Simulated Protocol Response (ACK):</h4>
                <pre>{validationResult.simulated_ack}</pre>
              </div>
            </div>
          )}

          {simulationResult && (
            <div className="hl7-simulation-card">
              <div className="card-header">
                <span className="badge-valid"><CheckCircle2 size={14} /> Ingestion Processed</span>
                <span>Event ID: #{simulationResult.event_id}</span>
              </div>
              <div className="created-records">
                <h4>Database Ingestion Summary:</h4>
                <ul>
                  {simulationResult.created_records?.patient && (
                    <li>
                      Patient Record: <strong>{simulationResult.created_records.patient.status}</strong> (ID: #{simulationResult.created_records.patient.id})
                    </li>
                  )}
                  {simulationResult.created_records?.accession && (
                    <li>
                      Accession Record: <strong>{simulationResult.created_records.accession.status}</strong> (ID: #{simulationResult.created_records.accession.id})
                    </li>
                  )}
                </ul>
              </div>
              <div className="ack-preview">
                <h4>Dispatched Protocol Acknowledgement (ACK):</h4>
                <pre>{simulationResult.acknowledgement}</pre>
              </div>
            </div>
          )}

          {!validationResult && !simulationResult && (
            <div className="hl7-empty-state">
              <p>Click "Validate Structure" or "Ingest & Simulate" to analyze the message above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
