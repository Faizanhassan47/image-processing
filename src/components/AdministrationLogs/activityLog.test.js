import { describe, expect, it } from 'vitest';
import { describeAuditEvent } from './activityLog';

describe('audit event descriptions', () => {
  it('turns case deletion data into plain language', () => {
    const result = describeAuditEvent({ action: 'case.delete', target_type: 'case', target_id: '12', details: '{"case_id":"CASE-12","slide_count":3}' });
    expect(result.title).toBe('Removed a case');
    expect(result.explanation).toBe('Removed case CASE-12 and 3 associated slide(s).');
  });

  it('provides readable copy for unknown events', () => {
    const result = describeAuditEvent({ action: 'report.approved', target_type: 'report', target_id: '8' });
    expect(result.title).toBe('Report Approved');
    expect(result.explanation).toContain('report 8');
  });
});
