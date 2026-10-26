import './Pagination.css';
import Button from '../Button/Button';

export default function Pagination({ page, pageSize, total, onPageChange, disabled = false, label = 'Pagination' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return <nav className="pagination" aria-label={label}>
    <Button size="sm" type="button" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
    <span>Page {page + 1} of {totalPages}</span>
    <Button size="sm" type="button" disabled={disabled || page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>Next</Button>
  </nav>;
}
