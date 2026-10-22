import { ChangeEvent, SubmitEvent, useMemo, useRef, useState } from 'react';
import { api, Campaign, Contact, Recipient, Template, WaNumber } from '../api';
import { CampaignStatusBadge, Empty, ErrorNote, fmtDate, Modal, toLocalInput, useLoad, usePolling } from '../components/ui';
import { formatWhatsAppText, WhatsAppToolbar } from '../components/WhatsAppComposer';

export default function Campaigns() {
  const { data, error, loading, reload } = useLoad(() => api.get<Campaign[]>('/campaigns'));
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Live progress while anything is running or about to start
  const active = !!data?.some((c) => c.status === 'running' || c.status === 'scheduled');
  usePolling(() => reload(true), 5000, active);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p>Send a message and photo to many contacts now or schedule it for later.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New campaign</button>
      </div>
      <ErrorNote error={error} />

      <div className="card flush">
        {loading ? (
          <Empty title="Loading…" />
        ) : !data?.length ? (
          <Empty title="No campaigns yet"><p>Create your first campaign to reach your contacts.</p></Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Status</th><th>Media</th><th>Audience</th><th>Progress</th><th>Scheduled for</th></tr></thead>
              <tbody>
                {data.map((c) => {
                  const done = c.sentCount + c.failedCount;
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(c.id)}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td><CampaignStatusBadge status={c.status} /></td>
                      <td>
                        {c.mediaUrl ? (
                          <span className="badge info" title="Includes photo">📷 Image</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="mono">{c.totalCount}</td>
                      <td>
                        <div className="row">
                          <div className="progress grow"><div style={{ width: `${c.totalCount ? (done / c.totalCount) * 100 : 0}%` }} /></div>
                          <span className="mono muted">{c.sentCount}/{c.totalCount}{c.failedCount ? ` · ${c.failedCount} failed` : ''}</span>
                        </div>
                      </td>
                      <td>{fmtDate(c.scheduledAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <CreateCampaign onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(true); }} />}
      {openId && <Detail id={openId} onClose={() => { setOpenId(null); reload(true); }} />}
    </div>
  );
}

function CreateCampaign({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const numbers = useLoad(() => api.get<WaNumber[]>('/numbers'));
  const contacts = useLoad(() => api.get<Contact[]>('/contacts'));
  const templates = useLoad(() => api.get<Template[]>('/templates'));
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [name, setName] = useState('');
  const [numberId, setNumberId] = useState('');
  const [message, setMessage] = useState('Hi *{{name}}*, 👋 ');
  const [mediaUrl, setMediaUrl] = useState('');
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [audience, setAudience] = useState<'all' | 'tags'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(new Date(Date.now() + 3600_000)));
  const [delay, setDelay] = useState(8);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connected = (numbers.data ?? []).filter((n) => n.status === 'ready');
  const allTags = useMemo(() => [...new Set((contacts.data ?? []).flatMap((c) => c.tags ?? []))].sort(), [contacts.data]);
  const audienceSize = useMemo(() => {
    const all = contacts.data ?? [];
    return audience === 'all' ? all.length : all.filter((c) => (c.tags ?? []).some((t) => tags.includes(t))).length;
  }, [contacts.data, audience, tags]);

  const applyTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = (templates.data ?? []).find((t) => t.id === tplId);
    if (!tpl) return;
    if (!name.trim()) setName(tpl.name);
    if (tpl.headerType === 'image' && tpl.headerContent) {
      setMediaUrl(tpl.headerContent);
    }
    let fullMessage = '';
    if (tpl.headerType === 'text' && tpl.headerContent) {
      fullMessage += `*${tpl.headerContent}*\n\n`;
    }
    fullMessage += tpl.body;
    if (tpl.footer) {
      fullMessage += `\n\n_${tpl.footer}_`;
    }
    setMessage(fullMessage);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP, etc.)');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Image size exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const c = await api.post<Campaign>('/campaigns', {
        name,
        numberId: numberId || connected[0]?.id,
        message,
        mediaUrl: mediaUrl.trim() || undefined,
        delaySeconds: delay,
        tags: audience === 'tags' ? tags : undefined,
        scheduledAt: when === 'later' ? new Date(scheduledAt).toISOString() : undefined,
      });
      if (when === 'now') await api.post(`/campaigns/${c.id}/start`);
      onCreated();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const preview = message.replace(/\{\{\s*name\s*\}\}/gi, 'Sara');

  return (
    <Modal title="New campaign" onClose={onClose} wide>
      <form className="stack" onSubmit={submit}>
        <ErrorNote error={err} />
        {numbers.data && !connected.length && <div className="notice">You need a connected WhatsApp number first. Add one under Numbers.</div>}

        {/* Template Selector Banner */}
        {!!templates.data?.length && (
          <div className="card attachment-card" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)', padding: '10px 14px' }}>
            <div className="row spread">
              <div>
                <b style={{ color: 'var(--brand)', fontSize: 13 }}>📋 Load from Template</b>
                <div className="hint">Quickly populate header, message body, and footer from a pre-made template.</div>
              </div>
              <select
                style={{ width: 220 }}
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">Select a template…</option>
                {templates.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid cols-2">
          <label className="field">Campaign name<input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Autumn Promo" /></label>
          <label className="field">
            Send from
            <select value={numberId || connected[0]?.id || ''} onChange={(e) => setNumberId(e.target.value)} required>
              {connected.map((n) => <option key={n.id} value={n.id}>{n.label}{n.phone ? ` (+${n.phone})` : ''}</option>)}
            </select>
          </label>
        </div>

        {/* Image Attachment Section */}
        <div className="card attachment-card">
          <div className="row spread" style={{ marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>📷 Attach Image (Optional)</span>
              <p className="hint" style={{ margin: '2px 0 0' }}>Send a photo banner, product flyer, or announcement along with your campaign.</p>
            </div>
            <div className="row">
              <button
                type="button"
                className={`btn sm ${imageTab === 'upload' ? 'primary' : ''}`}
                onClick={() => setImageTab('upload')}
              >
                Upload file
              </button>
              <button
                type="button"
                className={`btn sm ${imageTab === 'url' ? 'primary' : ''}`}
                onClick={() => setImageTab('url')}
              >
                Image URL
              </button>
            </div>
          </div>

          <ErrorNote error={uploadError} />

          {imageTab === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              {!mediaUrl ? (
                <div
                  className="upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') setMediaUrl(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                >
                  <span style={{ fontSize: 28, display: 'block', marginBottom: 4 }}>🖼️</span>
                  <b>Click to choose or drag & drop an image</b>
                  <span className="hint">PNG, JPG, WebP or GIF up to 15MB</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="field">
              <input
                type="url"
                placeholder="https://example.com/promo-banner.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
            </div>
          )}

          {mediaUrl && (
            <div className="image-preview-bar">
              <img src={mediaUrl} alt="Campaign attachment" className="image-thumb" />
              <div className="grow">
                <b>Image Attached</b>
                <div className="hint">Will be delivered to WhatsApp recipients with your message.</div>
              </div>
              <button
                type="button"
                className="btn sm danger"
                onClick={() => {
                  setMediaUrl('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                ✕ Remove image
              </button>
            </div>
          )}
        </div>

        {/* Message and WhatsApp Toolbar */}
        <div className="field">
          <div className="row spread">
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Campaign Message</span>
            <span className="hint">Use {'{{name}}'} to insert the contact’s first name</span>
          </div>

          <WhatsAppToolbar
            textareaRef={textareaRef}
            text={message}
            setText={setMessage}
            showVariable
            variableName="{{name}}"
          />

          <textarea
            ref={textareaRef}
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your campaign text here… Click Bold (*B*) or Emoji to format."
          />
        </div>

        {/* WhatsApp Preview Card */}
        <div className="wa-preview-card">
          <div className="wa-preview-head">
            <span>WhatsApp Message Preview</span>
            <span className="badge ok">Live Preview</span>
          </div>
          <div className="wa-preview-bubble">
            {mediaUrl && (
              <div className="wa-preview-image-wrap">
                <img src={mediaUrl} alt="Preview" className="wa-preview-image" />
              </div>
            )}
            <div className="wa-preview-text">
              {formatWhatsAppText(preview) || <span className="muted">Type a message above…</span>}
            </div>
            <div className="wa-preview-time mono">12:00 PM · Delivered ✓✓</div>
          </div>
        </div>

        <div className="grid cols-2">
          <div className="field">
            <span style={{ fontWeight: 500, fontSize: 13 }}>Audience</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value as 'all' | 'tags')} aria-label="Audience">
              <option value="all">All contacts</option>
              <option value="tags">Contacts with tags…</option>
            </select>
            {audience === 'tags' && (
              <div className="row wrap" style={{ marginTop: 4 }}>
                {allTags.length === 0 && <span className="hint">No tags yet — add some to your contacts.</span>}
                {allTags.map((t) => (
                  <label key={t} className="switch" style={{ fontWeight: 400 }}>
                    <input type="checkbox" checked={tags.includes(t)} onChange={(e) => setTags(e.target.checked ? [...tags, t] : tags.filter((x) => x !== t))} />
                    {t}
                  </label>
                ))}
              </div>
            )}
            <span className="hint">{audienceSize} recipient{audienceSize === 1 ? '' : 's'}</span>
          </div>

          <div className="field">
            <span style={{ fontWeight: 500, fontSize: 13 }}>When</span>
            <select value={when} onChange={(e) => setWhen(e.target.value as 'now' | 'later')} aria-label="When">
              <option value="now">Send now</option>
              <option value="later">Schedule for later</option>
            </select>
            {when === 'later' && <input type="datetime-local" required value={scheduledAt} min={toLocalInput(new Date())} onChange={(e) => setScheduledAt(e.target.value)} />}
          </div>
        </div>

        <label className="field">
          Delay between messages: {delay}s
          <input type="range" min={3} max={60} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
          <span className="hint">Slower sending is safer for your number. Estimated duration: ~{Math.ceil((audienceSize * delay) / 60)} min.</span>
        </label>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !connected.length || audienceSize === 0}>
            {busy ? 'Working…' : when === 'now' ? `Send to ${audienceSize}` : 'Schedule campaign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, reload } = useLoad(() => api.get<{ campaign: Campaign; recipients: Recipient[] }>(`/campaigns/${id}`), [id]);
  const [err, setErr] = useState<string | null>(null);
  const running = data?.campaign.status === 'running' || data?.campaign.status === 'scheduled';
  usePolling(() => reload(true), 4000, running);

  const act = async (path: string, method: 'post' | 'del' = 'post') => {
    setErr(null);
    try {
      await (method === 'post' ? api.post(`/campaigns/${id}${path}`) : api.del(`/campaigns/${id}`));
      method === 'del' ? onClose() : await reload(true);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const c = data?.campaign;
  return (
    <Modal title={c?.name ?? 'Campaign'} onClose={onClose} wide>
      <div className="stack">
        <ErrorNote error={error || err} />
        {c && (
          <>
            <div className="row wrap spread">
              <div className="row"><CampaignStatusBadge status={c.status} /><span className="muted">{c.sentCount} sent · {c.failedCount} failed · {c.totalCount} total</span></div>
              <div className="row">
                {(c.status === 'draft' || c.status === 'scheduled') && <button className="btn primary sm" onClick={() => act('/start')}>Send now</button>}
                {['draft', 'scheduled', 'running'].includes(c.status) && <button className="btn sm" onClick={() => act('/cancel')}>Cancel</button>}
                {c.status !== 'running' && <button className="btn sm danger" onClick={() => confirm('Delete this campaign?') && act('', 'del')}>Delete</button>}
              </div>
            </div>
            {c.scheduledAt && c.status === 'scheduled' && <div className="notice">Scheduled for {fmtDate(c.scheduledAt)}</div>}
            {c.lastError && <div className="error">Last error: {c.lastError}</div>}

            {c.mediaUrl && (
              <div className="card" style={{ padding: 12, background: 'var(--bg)', textAlign: 'center' }}>
                <img
                  src={c.mediaUrl}
                  alt={c.name}
                  style={{ maxHeight: 260, maxWidth: '100%', borderRadius: 8, display: 'inline-block', objectFit: 'contain' }}
                />
              </div>
            )}

            <div className="card" style={{ background: 'var(--bg)', whiteSpace: 'pre-wrap' }}>
              {formatWhatsAppText(c.message)}
            </div>

            <div className="card flush" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Recipient</th><th>Phone</th><th>Status</th></tr></thead>
                <tbody>
                  {data!.recipients.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="mono">+{r.phone}</td>
                      <td>
                        <span className={`badge ${r.status === 'sent' ? 'ok' : r.status === 'failed' ? 'bad' : ''}`} title={r.error}>
                          {r.status === 'sent' ? 'Sent' : r.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

