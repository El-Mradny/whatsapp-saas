import { QRCodeSVG } from 'qrcode.react';
import { FormEvent, useEffect, useState } from 'react';
import { api, WaNumber } from '../api';
import { Empty, ErrorNote, Modal, NumberStatusBadge, useLoad, usePolling } from '../components/ui';

export default function Numbers() {
  const { data, error, loading, reload } = useLoad(() => api.get<WaNumber[]>('/numbers'));
  const [adding, setAdding] = useState(false);
  const [pairing, setPairing] = useState<WaNumber | null>(null);
  const [editing, setEditing] = useState<WaNumber | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  // Keep statuses fresh while any number is still connecting
  const pending = !!data?.some((n) => n.status !== 'ready');
  usePolling(
    async () => {
      if (!data) return;
      await Promise.all(data.filter((n) => n.status !== 'ready').map((n) => api.post(`/numbers/${n.id}/sync`).catch(() => null)));
      reload(true);
    },
    6000,
    pending,
  );

  const remove = async (n: WaNumber) => {
    if (!confirm(`Remove "${n.label}"? The WhatsApp session will be deleted.`)) return;
    setActionErr(null);
    try {
      await api.del(`/numbers/${n.id}`);
      reload(true);
    } catch (e: any) {
      setActionErr(e.message);
    }
  };

  const restart = async (n: WaNumber) => {
    setActionErr(null);
    try {
      await api.post(`/numbers/${n.id}/restart`);
      reload(true);
      setPairing(n);
    } catch (e: any) {
      setActionErr(e.message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>WhatsApp numbers</h1>
          <p>Connect one or more numbers. Each one has its own inbox and AI settings.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add number</button>
      </div>
      <ErrorNote error={error || actionErr} />

      <div className="card flush">
        {loading ? (
          <Empty title="Loading…" />
        ) : !data?.length ? (
          <Empty title="No numbers yet">
            <p>Add your first number and scan the QR code with WhatsApp → Linked devices.</p>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Label</th><th>Phone</th><th>Status</th><th>AI replies</th><th></th></tr>
              </thead>
              <tbody>
                {data.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 600 }}>{n.label}</td>
                    <td className="mono">{n.phone ? `+${n.phone}` : <span className="muted">—</span>}</td>
                    <td><NumberStatusBadge status={n.status} /></td>
                    <td>{n.aiEnabled ? <span className="badge ok">On</span> : <span className="badge">Off</span>}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {n.status !== 'ready' && <button className="btn sm" onClick={() => setPairing(n)}>Connect</button>}
                        <button className="btn sm" onClick={() => setEditing(n)}>Settings</button>
                        {n.status === 'disconnected' && <button className="btn sm" onClick={() => restart(n)}>Restart</button>}
                        <button className="btn sm danger" onClick={() => remove(n)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && (
        <AddNumber
          onClose={() => setAdding(false)}
          onCreated={(n) => {
            setAdding(false);
            reload(true);
            setPairing(n);
          }}
        />
      )}
      {pairing && <Pair number={pairing} onClose={() => { setPairing(null); reload(true); }} />}
      {editing && <Settings number={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(true); }} />}
    </div>
  );
}

function AddNumber({ onClose, onCreated }: { onClose: () => void; onCreated: (n: WaNumber) => void }) {
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onCreated(await api.post<WaNumber>('/numbers', { label }));
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal title="Add WhatsApp number" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorNote error={err} />
        <label className="field">
          Label
          <input autoFocus required minLength={2} placeholder="e.g. Sales, Support" value={label} onChange={(e) => setLabel(e.target.value)} />
          <span className="hint">Only for you — customers never see it.</span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Creating session…' : 'Continue'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Pair({ number, onClose }: { number: WaNumber; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState(number.status);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.get<{ status: WaNumber['status']; qr: string | null }>(`/numbers/${number.id}/qr`);
      setStatus(r.status);
      setQr(r.qr);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  useEffect(() => void refresh(), []);
  usePolling(refresh, 4000, status !== 'ready');

  return (
    <Modal title={`Connect “${number.label}”`} onClose={onClose}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <ErrorNote error={err} />
        {status === 'ready' ? (
          <div className="success">Connected! You can close this window.</div>
        ) : qr ? (
          <>
            <div className="qr-box">
              {qr.startsWith('data:') ? <img src={qr} alt="WhatsApp pairing QR code" /> : <QRCodeSVG value={qr} size={240} />}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              On your phone open <b>WhatsApp → Settings → Linked devices → Link a device</b> and scan this code. It refreshes automatically.
            </p>
          </>
        ) : (
          <p className="muted">Waiting for the session to produce a QR code…</p>
        )}
        <button className="btn" onClick={onClose}>{status === 'ready' ? 'Done' : 'Close'}</button>
      </div>
    </Modal>
  );
}

function Settings({ number, onClose, onSaved }: { number: WaNumber; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(number.label);
  const [aiEnabled, setAi] = useState(number.aiEnabled);
  const [aiPrompt, setPrompt] = useState(number.aiPrompt ?? '');
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/numbers/${number.id}`, { label, aiEnabled, aiPrompt });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <Modal title="Number settings" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorNote error={err} />
        <label className="field">
          Label
          <input required minLength={2} value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="switch">
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAi(e.target.checked)} />
          Reply to incoming messages automatically with AI
        </label>
        <label className="field">
          AI instructions
          <textarea
            rows={7}
            placeholder={'Describe your business, tone and rules. Example:\nYou are the assistant for Acme Bakery. Opening hours 8–6, closed Sunday. Never promise delivery times; hand off to a human for refunds.'}
            value={aiPrompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <span className="hint">Leave empty for a polite general support assistant. Review replies in the Inbox — AI messages are tagged.</span>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
