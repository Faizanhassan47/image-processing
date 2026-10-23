import './Pagination.css';

export default function Pagination({ page, pageSize, total, onPageChange, disabled = false, label = 'Pagination' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return <nav className="pagination" aria-label={label}>
    <button type="button" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</button>
    <span>Page {page + 1} of {totalPages}</span>
    <button type="button" disabled={disabled || page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>Next</button>
  </nav>;
}
