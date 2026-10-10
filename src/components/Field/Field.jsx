import './Field.css';

export default function Field({ label, children }) {
  return <label className="input-group"><span>{label}</span>{children}</label>;
}
