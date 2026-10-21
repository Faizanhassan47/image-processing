import { useMemo } from 'react';

const normalize = (value) => String(value || '').trim().toLowerCase();

export function filterCaseWorklist(cases, { searchQuery, worklistTab, statusFilter, reviewerFilter, user }) {
  const query = normalize(searchQuery);
  const selectedTab = normalize(worklistTab);
  const selectedStatus = normalize(statusFilter);
  const selectedReviewer = normalize(reviewerFilter);
  const filteredCases = cases.filter((item) => {
    const reviewer = item.reviewer || '';
    const matchesSearch = !query || normalize(item.case_id).includes(query) || normalize(item.description).includes(query);
    const matchesTab = selectedTab === 'all'
      || (selectedTab === 'my cases' && reviewer && (reviewer === user?.display_name || reviewer === user?.username))
      || (selectedTab === 'unassigned' && !reviewer)
      || (selectedTab === 'awaiting review' && item.status === 'In Review')
      || (selectedTab === 'completed' && item.status === 'Reviewed');
    return matchesSearch && matchesTab
      && (selectedStatus === 'all' || normalize(item.status || 'New') === selectedStatus)
      && (selectedReviewer === 'all' || normalize(reviewer) === selectedReviewer);
  });
  const reviewers = [...new Set(cases.map((item) => item.reviewer).filter(Boolean))].sort();
  return { filteredCases, reviewers };
}

export default function useCaseWorklist(cases, { searchQuery, worklistTab, statusFilter, reviewerFilter, user }) {
  return useMemo(() => filterCaseWorklist(cases, { searchQuery, worklistTab, statusFilter, reviewerFilter, user }), [cases, reviewerFilter, searchQuery, statusFilter, user?.display_name, user?.username, worklistTab]);
}
