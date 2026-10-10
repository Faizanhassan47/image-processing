import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, FileText, Download, CheckCircle2, FileEdit } from 'lucide-react';
import './ReportEditor.css';
import { API_BASE_URL as API } from '../../config';
import { apiFetch } from '../../api';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';


function Field({ label, children }) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function ReportEditor({ selectedCase, selectSlide, setMessage }) {
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);
  const [reports, setReports] = useState([]);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!selectedCase) return;
    try {
      const res = await apiFetch(`${API}/api/cases/${selectedCase.id}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        const draft = data.find(r => r.status === 'Draft');
        setCurrentDraft(draft || null);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedCase]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const createDraft = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/api/cases/${selectedCase.id}/reports`, { method: 'POST' });
      if (res.ok) {
        await fetchReports();
        setMessage({ text: 'Draft report created/loaded.', type: 'success' });
        setPreviewMode(false);
      } else {
        const data = await res.json();
        setMessage({ text: data.detail || 'Could not create draft', type: 'error' });
      }
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!currentDraft || busy) return;
    setBusy(true);
    try {
      const form = e.target;
      const findings = currentDraft.findings.map((f, i) => ({
        ...f,
        text: form[`finding_${i}_text`]?.value || '',
        slide_id: form[`finding_${i}_slide`]?.value ? parseInt(form[`finding_${i}_slide`].value) : null,
        annotation_id: form[`finding_${i}_annotation`]?.value ? parseInt(form[`finding_${i}_annotation`].value) : null,
        sort_order: i
      }));
      
      const payload = {
        specimen_clinical: form.specimen_clinical.value,
        gross_description: form.gross_description.value,
        microscopic_findings: form.microscopic_findings.value,
        diagnosis: form.diagnosis.value,
        comments: form.comments.value,
        reviewer_name: form.reviewer_name.value,
        findings
      };

      const res = await apiFetch(`${API}/api/reports/${currentDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchReports();
      setMessage({ text: 'Draft saved successfully.', type: 'success' });
      setIsDirty(false);
      } else {
        const data = await res.json();
        setMessage({ text: data.detail || 'Failed to save', type: 'error' });
      }
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const addFinding = () => {
    setCurrentDraft(prev => ({
      ...prev,
      findings: [...prev.findings, { text: '', slide_id: '', annotation_id: '' }]
    }));
  };

  const removeFinding = (idx) => {
    setCurrentDraft(prev => ({
      ...prev,
      findings: prev.findings.filter((_, i) => i !== idx)
    }));
  };

  const finalizeReport = async (reportId) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API}/api/reports/${reportId}/finalize`, { method: 'POST' });
      if (res.ok) {
        await fetchReports();
        setMessage({ text: 'Report finalized!', type: 'success' });
      }
    } catch (e) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = (reportId) => {
    window.location.assign(`${API}/api/reports/${reportId}/pdf`);
  };

  const activeReport = previewMode ? (reports.find(r => r.status === 'Finalized') || currentDraft) : currentDraft;

  return (
    <div className="report-panel" style={{ marginTop: '20px', padding: '20px', border: '1px solid #334155', borderRadius: '8px' }}>
      <div className="review-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <FileText size={18} />
          <h3 style={{ margin: 0 }}>Case Report</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {currentDraft && !previewMode && (
            <button className="btn-control-secondary" onClick={() => setPreviewMode(true)}>Preview</button>
          )}
          {previewMode && (
            <button className="btn-control-secondary" onClick={() => setPreviewMode(false)}>Edit Draft</button>
          )}
          {!currentDraft && (
            <button className="btn-primary" onClick={createDraft} disabled={busy}>
              <Plus size={16} /> New Draft/Revision
            </button>
          )}
        </div>
      </div>

      {reports.length > 0 && (
        <div style={{ marginBottom: '20px', fontSize: '0.9em', color: '#94a3b8' }}>
          <strong>Version History: </strong>
          {reports.map(r => (
            <span key={r.id} style={{ marginRight: '10px' }}>
              V{r.version} ({r.status})
              {r.status === 'Finalized' && (
                <button type="button" onClick={() => handleDownload(r.id)} title="Download PDF" style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', marginLeft: '4px' }}>
                  <Download size={14} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {currentDraft && !previewMode && (
        <form onSubmit={handleUpdate} onChange={() => setIsDirty(true)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Specimen & Clinical"><textarea name="specimen_clinical" defaultValue={currentDraft.specimen_clinical} rows={3} /></Field>
            <Field label="Gross Description"><textarea name="gross_description" defaultValue={currentDraft.gross_description} rows={3} /></Field>
            <Field label="Microscopic Findings"><textarea name="microscopic_findings" defaultValue={currentDraft.microscopic_findings} rows={4} /></Field>
            <Field label="Diagnosis"><textarea name="diagnosis" defaultValue={currentDraft.diagnosis} rows={3} /></Field>
          </div>
          <Field label="Comments"><input name="comments" defaultValue={currentDraft.comments} /></Field>
          <Field label="Reviewer Name"><input name="reviewer_name" defaultValue={currentDraft.reviewer_name} required maxLength={120} /></Field>

          <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Specific Findings</h4>
              <button type="button" onClick={addFinding} className="btn-control-secondary"><Plus size={14} /> Add Finding</button>
            </div>
            {currentDraft.findings.map((f, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'flex-start' }}>
                <textarea name={`finding_${idx}_text`} defaultValue={f.text} placeholder="Finding description" rows={2} style={{ flex: 1 }} required />
                <select name={`finding_${idx}_slide`} defaultValue={f.slide_id || ''}>
                  <option value="">No slide linked</option>
                  {selectedCase.slides.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select name={`finding_${idx}_annotation`} defaultValue={f.annotation_id || ''}>
                  <option value="">No annotation linked</option>
                  {/* For simplicity in this demo, you'd need the annotations for each slide. 
                      Since we don't fetch annotations for all slides globally, this select might just accept ID for now 
                      or remain simple. In full implementation, fetch annotations on slide change. */}
                </select>
                <button type="button" onClick={() => removeFinding(idx)} className="btn-control-secondary" style={{ padding: '8px' }}><Trash2 size={16} color="#ef4444" /></button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="submit" className="btn-primary" disabled={busy}><FileEdit size={16} /> Save Draft</button>
            <button type="button" className="btn-primary" style={{ backgroundColor: '#10b981' }} onClick={() => finalizeReport(currentDraft.id)} disabled={busy}>
              <CheckCircle2 size={16} /> Finalize
            </button>
          </div>
        </form>
      )}

      {activeReport && previewMode && (
        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '4px' }}>
          <h2 style={{ textAlign: 'center' }}>Pathology Report</h2>
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Case {selectedCase.case_id} | Status: {activeReport.status} | Version {activeReport.version}</p>
          <hr style={{ borderColor: '#334155' }} />
          
          <div style={{ marginTop: '20px' }}>
            <p><strong>Specimen & Clinical:</strong> {activeReport.specimen_clinical}</p>
            <p><strong>Gross Description:</strong> {activeReport.gross_description}</p>
            <p><strong>Microscopic Findings:</strong> {activeReport.microscopic_findings}</p>
            <p><strong>Diagnosis:</strong> {activeReport.diagnosis}</p>
            <p><strong>Comments:</strong> {activeReport.comments}</p>
            <p><strong>Reviewer:</strong> {activeReport.reviewer_name}</p>
          </div>

          {activeReport.findings.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4>Specific Findings</h4>
              <ul>
                {activeReport.findings.map((f, i) => (
                  <li key={i}>
                    {f.text} 
                    {f.slide_id && (
                      <button type="button" onClick={() => {
                        const slide = selectedCase.slides.find(s => s.id === f.slide_id);
                        if(slide) selectSlide(slide);
                      }} style={{ marginLeft: '8px', background: 'none', border: '1px solid #06b6d4', color: '#06b6d4', borderRadius: '4px', cursor: 'pointer' }}>
                        View Slide {f.slide_id}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => handleDownload(activeReport.id)} className="btn-primary" disabled={busy}><Download size={16} /> Download PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}
