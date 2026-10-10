import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import './Status.css';

export default function Status({ message }) {
  const Icon = message.type === 'error' ? AlertCircle : message.type === 'success' ? CheckCircle2 : Info;
  return <div role="status" className={`status-banner status-${message.type}`}><Icon size={18} />{message.text}</div>;
}
