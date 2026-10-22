import { ChangeEvent, SubmitEvent , useMemo, useState } from 'react';
import { api, Contact } from '../api';
import { Empty, ErrorNote, Modal, useLoad } from '../components/ui';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const { data, error, loading, reload } = useLoad(
    () => api.get<Contact[]>(`/contacts?search=${encodeURIComponent(search)}&tag=${encodeURIComponent(tag)}`),
    [search, tag],
  );
  const [edit, setEdit] = useState<Contact | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const allTags = useMemo(() => [...new Set((data ?? []).flatMap((c) => c.tags ?? []))].sort(), [data]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} contact(s)?`)) return;
    try {
      await api.post('/contacts/bulk-delete', { ids: [...selected] });
      setSelected(new Set());
      await reload(true);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Contacts</h1>
          <p>{data ? `${data.length} contact${data.length === 1 ? '' : 's'}` : ' '}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setImporting(true)}>Import CSV</button>
          <button className="btn primary" onClick={() => setEdit('new')}>+ Add contact</button>
        </div>
      </div>
      <ErrorNote error={error || err} />

      <div className="row wrap">
        <input style={{ maxWidth: 280 }} placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ maxWidth: 180 }} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t}>{t}</option>)}
        </select>
        {selected.size > 0 && <button className="btn danger" onClick={bulkDelete}>Delete {selected.size} selected</button>}
      </div>

      <div className="card flush">
        {loading ? (
          <Empty title="Loading…" />
        ) : !data?.length ? (
          <Empty title="No contacts found">
            <p>Add contacts one by one or import a CSV with columns <code>name, phone, tags</code>.</p>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={selected.size === data.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(data.map((c) => c.id)) : new Set())}
                    />
                  </th>
                  <th>Name</th><th>Phone</th><th>Tags</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="mono">+{c.phone}</td>
                    <td>{(c.tags ?? []).map((t) => <span className="tag" key={t}>{t}</span>)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn sm" onClick={() => setEdit(c)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && <ContactForm contact={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(true); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload(true); }} />}
    </div>
  );
}

function ContactForm({ contact, onClose, onSaved }: { contact: Contact | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [tags, setTags] = useState((contact?.tags ?? []).join(', '));
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: SubmitEvent ) => {
    e.preventDefault();
    const body = { name, phone, notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) };
    try {
      contact ? await api.patch(`/contacts/${contact.id}`, body) : await api.post('/contacts', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const remove = async () => {
    if (!contact || !confirm('Delete this contact?')) return;
    await api.del(`/contacts/${contact.id}`);
    onSaved();
  };

  return (
    <Modal title={contact ? 'Edit contact' : 'Add contact'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <ErrorNote error={err} />
        <label className="field">Name<input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field">
          Phone <span className="hint">with country code, e.g. 201001234567</span>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="field">
          Tags <span className="hint">comma-separated, used to target campaigns</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, cairo" />
        </label>
        <label className="field">Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="row spread">
          <div>{contact && <button type="button" className="btn danger" onClick={remove}>Delete</button>}</div>
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary">Save</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCsv(await f.text());
  };
  const submit = async () => {
    setErr(null);
    try {
      setResult(await api.post('/contacts/import', { csv }));
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Modal title="Import contacts" onClose={result ? onDone : onClose}>
      <div className="stack">
        <ErrorNote error={err} />
        {result ? (
          <>
            <div className="success">Imported {result.created} contacts. Skipped {result.skipped} (invalid or duplicate).</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={onDone}>Done</button></div>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              CSV with a header row and columns <code>name</code>, <code>phone</code>, and optionally <code>tags</code> (separate several with <code>;</code>).
            </p>
            <input type="file" accept=".csv,text/csv" onChange={onFile} />
            <textarea rows={7} placeholder={'name,phone,tags\nSara Ali,201001234567,vip;cairo'} value={csv} onChange={(e) => setCsv(e.target.value)} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={!csv.trim()} onClick={submit}>Import</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
