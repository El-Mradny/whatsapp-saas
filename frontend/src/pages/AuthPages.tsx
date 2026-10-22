import { ChangeEvent, SubmitEvent , ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ErrorNote } from '../components/ui';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-aside">
        <div className="row" style={{ fontWeight: 700, fontSize: 20 }}>
          <span className="brand-mark" style={{ background: 'rgba(255,255,255,.2)' }}>W</span> Wavely
        </div>
        <h1>Talk to every customer, at scale.</h1>
        <p>Run WhatsApp campaigns, answer from one shared inbox, and let AI handle the repetitive replies.</p>
        <ul>
          <li>Bulk campaigns with scheduling &amp; throttling</li>
          <li>Multiple WhatsApp numbers per account</li>
          <li>AI auto-replies you control</li>
        </ul>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <div>
            <h1>{title}</h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: SubmitEvent ) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      nav('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your account">
      <form className="stack" onSubmit={submit}>
        <ErrorNote error={error} />
        <label className="field">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="muted">
          New here? <Link to="/register">Create an account</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', company: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: SubmitEvent ) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...f, company: f.company || undefined });
      nav('/numbers'); // first step: connect a WhatsApp number
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start sending in minutes">
      <form className="stack" onSubmit={submit}>
        <ErrorNote error={error} />
        <label className="field">
          Full name
          <input required minLength={2} autoComplete="name" value={f.name} onChange={set('name')} />
        </label>
        <label className="field">
          Company <span className="hint">optional</span>
          <input autoComplete="organization" value={f.company} onChange={set('company')} />
        </label>
        <label className="field">
          Email
          <input type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </label>
        <label className="field">
          Password <span className="hint">at least 8 characters</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
        </label>
        <button className="btn primary" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <div className="muted">
          Already registered? <Link to="/login">Sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
