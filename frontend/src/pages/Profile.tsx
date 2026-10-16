import { FormEvent, useState } from 'react';
import { api, User } from '../api';
import { useAuth } from '../auth';
import { ErrorNote } from '../components/ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({
    name: user?.name ?? '',
    company: user?.company ?? '',
    phone: user?.phone ?? '',
    timezone: user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      setUser(await api.patch<User>('/auth/me', f));
      setMsg('Profile saved');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    try {
      await api.post('/auth/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      setPwMsg('Password updated');
    } catch (e: any) {
      setPwErr(e.message);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <p>Your account details and security.</p>
        </div>
      </div>

      <form className="card stack" onSubmit={save}>
        <h2>Account</h2>
        <ErrorNote error={err} />
        {msg && <div className="success">{msg}</div>}
        <label className="field">
          Email
          <input value={user?.email ?? ''} disabled />
        </label>
        <label className="field">
          Full name
          <input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <div className="grid cols-2">
          <label className="field">
            Company
            <input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          </label>
          <label className="field">
            Phone
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </label>
        </div>
        <label className="field">
          Time zone
          <input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />
        </label>
        <div>
          <button className="btn primary">Save changes</button>
        </div>
      </form>

      <form className="card stack" onSubmit={changePw}>
        <h2>Change password</h2>
        <ErrorNote error={pwErr} />
        {pwMsg && <div className="success">{pwMsg}</div>}
        <label className="field">
          Current password
          <input type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </label>
        <label className="field">
          New password <span className="hint">at least 8 characters</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </label>
        <div>
          <button className="btn">Update password</button>
        </div>
      </form>
    </div>
  );
}
