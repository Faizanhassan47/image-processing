import './Tabs.css';

export default function Tabs({ items, value, onChange, className = '', ariaLabel = 'Sections' }) {
  const classes = ['app-tabs', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={item.panelId}
            className={`app-tabs__tab${active ? ' app-tabs__tab--active' : ''}`}
            onClick={() => onChange(item.value)}
            disabled={item.disabled}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
