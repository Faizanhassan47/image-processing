import { describe, expect, it } from 'vitest';
import { filterCaseWorklist } from '../modules/workspace/useCaseWorklist';

const cases = [
  { id: 1, case_id: 'CASE-001', description: 'Unassigned case', status: 'New', reviewer: '' },
  { id: 2, case_id: 'CASE-002', description: 'Assigned case', status: 'In Review', reviewer: 'dr_alice' },
];

describe('filterCaseWorklist', () => {
  it('returns every case for the All worklist regardless of a differently cased All filter', () => {
    const result = filterCaseWorklist(cases, {
      searchQuery: '', worklistTab: 'All', statusFilter: ' all ', reviewerFilter: 'ALL', user: { username: 'dr_alice' },
    });

    expect(result.filteredCases).toHaveLength(2);
  });
});
