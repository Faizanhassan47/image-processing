import './EmptyState.css';

export default function EmptyState({ icon: Icon, title, text, action }) {
  return <div className="empty-state"><Icon size={38} opacity={0.3} /><p>{title}</p><span>{text}</span>{action && <div className="empty-state__action">{action}</div>}</div>;
}
