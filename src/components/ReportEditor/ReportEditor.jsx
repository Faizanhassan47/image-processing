import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, FileEdit, FileText, Plus, Trash2 } from 'lucide-react';
import './ReportEditor.css';
import { API_BASE_URL as API } from '../../config';
import { apiFetch } from '../../api';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import Modal from '../Modal/Modal';

function Field({ label, children }) {
  return <label className="field-group"><span className="field-label">{label}</span>{children}</label>;
}

export default function ReportEditor({ selectedCase, selectSlide, setMessage }) {
  const [isDirty, setIsDirty] = useState(false);
  const [reports, setReports] = useState([]);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [annotationsBySlide, setAnnotationsBySlide] = useState({});
  useUnsavedChanges(isDirty);

  const fetchReports = useCallback(async () => {
    if (!selectedCase) return;
    try {
      const response = await apiFetch(`${API}/api/cases/${selectedCase.id}/reports`);
      if (!response.ok) throw new Error('Could not load reports');
      const data = await response.json();
      setReports(data);
      setCurrentDraft(data.find((report) => report.status === 'Draft') || null);
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    }
  }, [selectedCase, setMessage]);

  useEffect(() => {
    let mounted = true;
    if (!selectedCase) return;
    (async () => {
      try {
        const response = await apiFetch(`${API}/api/cases/${selectedCase.id}/reports`);
        if (!mounted) return;
        if (!response.ok) throw new Error('Could not load reports');
        const data = await response.json();
        if (mounted) {
          setReports(data);
          setCurrentDraft(data.find((report) => report.status === 'Draft') || null);
        }
      } catch (error) {
        if (mounted) setMessage({ text: error.message, type: 'error' });
      }
    })();
    return () => { mounted = false; };
  }, [selectedCase, setMessage]);

  const createDraft = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/api/cases/${selectedCase.id}/reports`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not create draft');
      await fetchReports();
      setActiveTab('edit');
      setMessage({ text: 'Draft report is ready.', type: 'success' });
    } catch (error) { setMessage({ text: error.message, type: 'error' }); }
    finally { setBusy(false); }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!currentDraft || busy) return;
    setBusy(true);
    const form = event.currentTarget;
    const findings = currentDraft.findings.map((finding, index) => ({
      ...finding,
      text: form[`finding_${index}_text`]?.value || '',
      slide_id: form[`finding_${index}_slide`]?.value ? Number(form[`finding_${index}_slide`].value) : null,
      annotation_id: form[`finding_${index}_annotation`]?.value ? Number(form[`finding_${index}_annotation`].value) : null,
      sort_order: index,
    }));
    const payload = {
      specimen_clinical: form.specimen_clinical.value,
      gross_description: form.gross_description.value,
      microscopic_findings: form.microscopic_findings.value,
      diagnosis: form.diagnosis.value,
      comments: form.comments.value,
      reviewer_name: form.reviewer_name.value,
      findings,
    };
    try {
      const response = await apiFetch(`${API}/api/reports/${currentDraft.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to save report');
      await fetchReports();
      setIsDirty(false);
      setMessage({ text: 'Draft saved.', type: 'success' });
    } catch (error) { setMessage({ text: error.message, type: 'error' }); }
    finally { setBusy(false); }
  };

  const loadAnnotations = async (slideId) => {
    if (!slideId || annotationsBySlide[slideId]) return;
    try {
      const response = await apiFetch(`${API}/api/slides/${slideId}/annotations`);
      if (response.ok) {
        const items = await response.json();
        setAnnotationsBySlide((current) => ({ ...current, [slideId]: items }));
      }
    } catch { /* A missing annotation list should not block report editing. */ }
  };

  const updateFindingSlide = (index, slideId) => {
    setCurrentDraft((draft) => ({ ...draft, findings: draft.findings.map((finding, itemIndex) => itemIndex === index
      ? { ...finding, slide_id: slideId ? Number(slideId) : '', annotation_id: '' } : finding) }));
    setIsDirty(true);
    loadAnnotations(slideId);
  };

  const finalizeReport = async () => {
    if (!currentDraft || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch(`${API}/api/reports/${currentDraft.id}/finalize`, { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).detail || 'Could not finalize report');
      await fetchReports();
      setIsDirty(false);
      setActiveTab('versions');
      setConfirmFinalize(false);
      setMessage({ text: 'Report finalized.', type: 'success' });
    } catch (error) { setMessage({ text: error.message, type: 'error' }); }
    finally { setBusy(false); }
  };

  const activeReport = reports.find((report) => report.status === 'Finalized') || currentDraft;

  return <section className="report-panel" aria-labelledby="report-heading">
    <header className="report-header">
      <div className="report-heading"><FileText size={18} /><div><h3 id="report-heading">Case report</h3><p>Draft, review and finalize the case record.</p></div></div>
      {!currentDraft && <button type="button" className="btn-primary" onClick={createDraft} disabled={busy}><Plus size={16} /> New draft</button>}
    </header>

    <div className="report-tabs" role="tablist" aria-label="Report sections">
      {['edit', 'preview', 'versions'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab}
        className={activeTab === tab ? 'report-tab report-tab--active' : 'report-tab'} onClick={() => setActiveTab(tab)}
        disabled={tab !== 'versions' && !activeReport}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
    </div>

    {activeTab === 'edit' && currentDraft && <form className="report-form" onSubmit={handleUpdate} onChange={() => setIsDirty(true)}>
      <div className="report-field-grid">
        <Field label="Specimen and clinical details"><textarea name="specimen_clinical" defaultValue={currentDraft.specimen_clinical} rows={3} /></Field>
        <Field label="Gross description"><textarea name="gross_description" defaultValue={currentDraft.gross_description} rows={3} /></Field>
        <Field label="Microscopic findings"><textarea name="microscopic_findings" defaultValue={currentDraft.microscopic_findings} rows={4} /></Field>
        <Field label="Diagnosis"><textarea name="diagnosis" defaultValue={currentDraft.diagnosis} rows={4} /></Field>
      </div>
      <Field label="Comments"><textarea name="comments" defaultValue={currentDraft.comments} rows={2} /></Field>
      <Field label="Reviewer name"><input name="reviewer_name" defaultValue={currentDraft.reviewer_name} required maxLength={120} /></Field>

      <section className="report-findings">
        <header><div><h4>Linked findings</h4><p>Connect each finding to its supporting slide or annotation.</p></div>
          <button type="button" className="btn-control-secondary" onClick={() => { setCurrentDraft((draft) => ({ ...draft, findings: [...draft.findings, { text: '', slide_id: '', annotation_id: '' }] })); setIsDirty(true); }}><Plus size={14} /> Add finding</button></header>
        {!currentDraft.findings.length && <p className="report-empty">No linked findings have been added.</p>}
        {currentDraft.findings.map((finding, index) => <div className="finding-row" key={`${finding.id || 'new'}-${index}`}>
          <textarea name={`finding_${index}_text`} defaultValue={finding.text} placeholder="Describe the finding" rows={2} required aria-label={`Finding ${index + 1}`} />
          <select name={`finding_${index}_slide`} value={finding.slide_id || ''} onChange={(event) => updateFindingSlide(index, event.target.value)} aria-label={`Slide for finding ${index + 1}`}>
            <option value="">No slide linked</option>{selectedCase.slides.map((slide) => <option key={slide.id} value={slide.id}>{slide.label}</option>)}
          </select>
          <select name={`finding_${index}_annotation`} defaultValue={finding.annotation_id || ''} disabled={!finding.slide_id} aria-label={`Annotation for finding ${index + 1}`}>
            <option value="">No annotation linked</option>{(annotationsBySlide[finding.slide_id] || []).map((annotation) => <option key={annotation.id} value={annotation.id}>{annotation.label}</option>)}
          </select>
          <button type="button" className="icon-button icon-button--danger" aria-label={`Remove finding ${index + 1}`} onClick={() => { setCurrentDraft((draft) => ({ ...draft, findings: draft.findings.filter((_, itemIndex) => itemIndex !== index) })); setIsDirty(true); }}><Trash2 size={16} /></button>
        </div>)}
      </section>

      <footer className="report-actions"><span className={isDirty ? 'save-state save-state--dirty' : 'save-state'}>{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button type="submit" className="btn-primary" disabled={busy}><FileEdit size={16} /> {busy ? 'Saving…' : 'Save draft'}</button>
        <button type="button" className="btn-success" onClick={() => setConfirmFinalize(true)} disabled={busy || isDirty}><CheckCircle2 size={16} /> Finalize</button></footer>
    </form>}

    {activeTab === 'edit' && !currentDraft && <div className="report-empty-state"><FileText size={28} /><h4>No draft report</h4><p>Create a draft to begin documenting this case.</p></div>}

    {activeTab === 'preview' && activeReport && <article className="report-preview">
      <header><p>Digital Pathology</p><h2>Pathology report</h2><span>Case {selectedCase.case_id} · Version {activeReport.version} · {activeReport.status}</span></header>
      {[['Specimen and clinical details', activeReport.specimen_clinical], ['Gross description', activeReport.gross_description], ['Microscopic findings', activeReport.microscopic_findings], ['Diagnosis', activeReport.diagnosis], ['Comments', activeReport.comments]].map(([title, value]) => value && <section key={title}><h3>{title}</h3><p>{value}</p></section>)}
      {!!activeReport.findings.length && <section><h3>Linked findings</h3><ol>{activeReport.findings.map((finding, index) => <li key={finding.id || index}>{finding.text}{finding.slide_id && <button type="button" className="text-action" onClick={() => { const slide = selectedCase.slides.find((item) => item.id === finding.slide_id); if (slide) selectSlide(slide); }}>Open supporting slide</button>}</li>)}</ol></section>}
      <footer><span>Reviewer: {activeReport.reviewer_name || 'Not assigned'}</span><button type="button" className="btn-primary" onClick={() => window.location.assign(`${API}/api/reports/${activeReport.id}/pdf`)}><Download size={16} /> Download PDF</button></footer>
    </article>}

    {activeTab === 'versions' && <div className="report-versions">
      {!reports.length ? <p className="report-empty">No report versions exist.</p> : reports.map((report) => <article key={report.id}><div><strong>Version {report.version}</strong><span className={`report-status report-status--${report.status.toLowerCase()}`}>{report.status}</span></div><p>{report.reviewer_name || 'No reviewer'} · {report.finalized_at || report.created_at}</p>{report.status === 'Finalized' && <button type="button" className="btn-control-secondary" onClick={() => window.location.assign(`${API}/api/reports/${report.id}/pdf`)}><Download size={15} /> PDF</button>}</article>)}
    </div>}

    <Modal open={confirmFinalize} title="Finalize report" onClose={() => setConfirmFinalize(false)} footer={<><button type="button" className="modal-button modal-button--secondary" onClick={() => setConfirmFinalize(false)}>Cancel</button><button type="button" className="modal-button modal-button--primary" onClick={finalizeReport} disabled={busy}>{busy ? 'Finalizing…' : 'Finalize report'}</button></>}>
      <p className="confirmation-copy">Finalized versions become read-only. Confirm that the report has been reviewed and is ready to publish.</p>
    </Modal>
  </section>;
}
