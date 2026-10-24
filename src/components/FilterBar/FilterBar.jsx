import './FilterBar.css';

export default function FilterBar({ children, label = 'Filters', className = '' }) {
  return <section className={`filter-bar ${className}`.trim()} aria-label={label}>{children}</section>;
}
