import { useMemo } from 'react';

export default function useCaseWorklist(cases, { searchQuery, worklistTab, statusFilter, reviewerFilter, user }) {
  return useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filteredCases = cases.filter((item) => {
      const matchesSearch = !query || item.case_id.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query);
      const matchesTab = worklistTab === 'All' ? true
        : worklistTab === 'My Cases' ? (item.reviewer && (item.reviewer === user?.display_name || item.reviewer === user?.username))
        : worklistTab === 'Unassigned' ? !item.reviewer
        : worklistTab === 'Awaiting Review' ? item.status === 'In Review'
        : worklistTab === 'Completed' ? item.status === 'Reviewed' : true;
      return matchesSearch && matchesTab
        && (statusFilter === 'All' || (item.status || 'New') === statusFilter)
        && (reviewerFilter === 'All' || (item.reviewer || '') === reviewerFilter);
    });
    const reviewers = [...new Set(cases.map((item) => item.reviewer).filter(Boolean))].sort();
    return { filteredCases, reviewers };
  }, [cases, reviewerFilter, searchQuery, statusFilter, user?.display_name, worklistTab]);
}
