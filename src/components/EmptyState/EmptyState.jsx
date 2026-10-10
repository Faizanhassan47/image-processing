import './EmptyState.css';

export default function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><Icon size={38} opacity={0.3} /><p>{title}</p><span>{text}</span></div>;
}
