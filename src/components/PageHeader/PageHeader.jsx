import './PageHeader.css';

export default function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  return <header className={`page-header ${className}`.trim()}>
    <div>
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="page-header__description">{description}</p>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>;
}
