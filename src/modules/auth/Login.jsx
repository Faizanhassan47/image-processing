import { useState } from 'react';
import { Eye, EyeOff, Microscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const result = await login(username, password);
    if (!result.success) toast.error(result.message);
    setLoading(false);
  };

  return <main className="login-container">
    <section className="login-box" aria-labelledby="login-title">
      <header className="login-header">
        <div className="login-logo" aria-hidden="true"><Microscope size={27} /></div>
        <p className="login-eyebrow">Laboratory workspace</p>
        <h1 id="login-title">Digital Pathology</h1>
        <p className="login-subtitle">Sign in to continue to the case worklist.</p>
      </header>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="login-username">Username</label>
          <input id="login-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" placeholder="Enter your username" autoFocus />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <div className="password-field">
            <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)}
              onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))} required autoComplete="current-password" placeholder="Enter your password" />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {capsLock && <p className="field-hint field-hint--warning" role="status">Caps Lock is on.</p>}
        </div>
        <button type="submit" disabled={loading}>{loading ? <><span className="loading-spinner loading-spinner--button" /> Signing in…</> : 'Sign in'}</button>
      </form>
      <p className="login-disclaimer">Authorized laboratory use only. This prototype is not a diagnostic system.</p>
    </section>
  </main>;
}
