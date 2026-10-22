import { ChangeEvent, SubmitEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Template, TemplateButton, TemplateCategory, TemplateHeaderType } from '../api';
import { Empty, ErrorNote, Modal, useLoad } from '../components/ui';
import { WhatsAppToolbar } from '../components/WhatsAppComposer';
import { WhatsAppTemplateCard } from '../components/WhatsAppTemplateCard';

const CATEGORIES: { label: string; value: TemplateCategory }[] = [
  { label: 'Marketing', value: 'MARKETING' },
  { label: 'Utility', value: 'UTILITY' },
  { label: 'Customer Support', value: 'SUPPORT' },
  { label: 'Authentication', value: 'AUTHENTICATION' },
];

export default function Templates() {
  const { data, error, loading, reload } = useLoad(() => api.get<Template[]>('/templates'));
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const navigate = useNavigate();

  const openCreate = () => {
    setEditingTemplate(null);
    setModalMode('create');
  };

  const openEdit = (tpl: Template) => {
    setEditingTemplate(tpl);
    setModalMode('edit');
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.del(`/templates/${id}`);
      await reload(true);
    } catch (e: any) {
      alert(e.message || 'Failed to delete template');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Message Templates</h1>
          <p>Create professional WhatsApp templates with headers, rich bodies, footers, and interactive buttons.</p>
        </div>
        <button className="btn primary" onClick={openCreate}>
          + New Template
        </button>
      </div>
      <ErrorNote error={error} />

      {loading ? (
        <div className="card flush"><Empty title="Loading templates…" /></div>
      ) : !data?.length ? (
        <div className="card flush">
          <Empty title="No templates yet">
            <p>Create your first message template to standardize and speed up customer communications.</p>
            <button className="btn primary" onClick={openCreate} style={{ marginTop: 12 }}>Create Template</button>
          </Empty>
        </div>
      ) : (
        <div className="grid cols-3 templates-grid">
          {data.map((tpl) => (
            <div key={tpl.id} className="card template-card-box">
              <div className="template-card-header">
                <div>
                  <h3 className="template-title">{tpl.name}</h3>
                  <span className={`badge ${tpl.category === 'MARKETING' ? 'ok' : 'info'}`}>
                    {tpl.category}
                  </span>
                </div>
                <div className="row">
                  <button className="btn sm ghost" onClick={() => openEdit(tpl)} title="Edit template">
                    ✏️
                  </button>
                  <button className="btn sm ghost danger" onClick={() => deleteTemplate(tpl.id)} title="Delete template">
                    🗑️
                  </button>
                </div>
              </div>

              {/* WhatsApp Mockup Preview */}
              <div className="template-preview-container">
                <WhatsAppTemplateCard
                  headerType={tpl.headerType}
                  headerContent={tpl.headerContent}
                  body={tpl.body}
                  footer={tpl.footer}
                  buttons={tpl.buttons}
                  compact
                />
              </div>

              <div className="template-card-actions">
                <button
                  type="button"
                  className="btn primary sm grow"
                  onClick={() => navigate('/campaigns')}
                >
                  Use in Campaign ➤
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode && (
        <TemplateModal
          mode={modalMode}
          template={editingTemplate}
          onClose={() => setModalMode(null)}
          onSaved={() => {
            setModalMode(null);
            reload(true);
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({
  mode,
  template,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? 'MARKETING');
  const [headerType, setHeaderType] = useState<TemplateHeaderType>(template?.headerType ?? 'text');
  const [headerContent, setHeaderContent] = useState(template?.headerContent ?? 'Exclusive Announcement 🌟');
  const [body, setBody] = useState(template?.body ?? 'Hi *{{name}}*,\n\nWe have an exciting update for you! Enjoy our new offerings and features today.');
  const [footer, setFooter] = useState(template?.footer ?? 'Reply STOP to unsubscribe • Wavely');
  const [buttons, setButtons] = useState<TemplateButton[]>(
    template?.buttons?.length
      ? template.buttons
      : [
          { type: 'quick_reply', text: 'Learn More 🔍' },
          { type: 'url', text: 'Visit Website 🌐', value: 'https://example.com' },
        ],
  );

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setHeaderContent(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type: 'quick_reply', text: `Option ${buttons.length + 1}` }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, patch: Partial<TemplateButton>) => {
    setButtons(buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const payload = {
      name: name.trim(),
      category,
      headerType,
      headerContent: headerType === 'none' ? null : headerContent.trim() || null,
      body: body.trim(),
      footer: footer.trim() || null,
      buttons,
    };

    try {
      if (mode === 'create') {
        await api.post('/templates', payload);
      } else if (template) {
        await api.patch(`/templates/${template.id}`, payload);
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Failed to save template');
      setBusy(false);
    }
  };

  // Preview replacement of {{name}}
  const previewBody = body.replace(/\{\{\s*name\s*\}\}/gi, 'Sara');

  return (
    <Modal title={mode === 'create' ? 'Create WhatsApp Template' : 'Edit Template'} onClose={onClose} wide>
      <form onSubmit={submit} className="stack">
        <ErrorNote error={err} />

        <div className="template-modal-layout">
          {/* Left Column: Form Controls */}
          <div className="template-form-column stack">
            <div className="grid cols-2">
              <label className="field">
                Template Name
                <input
                  required
                  autoFocus
                  placeholder="e.g. promo_october"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="field">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Header Configuration */}
            <div className="card attachment-card">
              <div className="row spread" style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Template Header</span>
                <div className="row">
                  {(['none', 'text', 'image'] as TemplateHeaderType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`btn sm ${headerType === type ? 'primary' : ''}`}
                      onClick={() => setHeaderType(type)}
                    >
                      {type === 'none' ? 'None' : type === 'text' ? 'Bold Text' : '📷 Image'}
                    </button>
                  ))}
                </div>
              </div>

              {headerType === 'text' && (
                <input
                  placeholder="Header text heading (e.g. Special Announcement! 🎉)"
                  value={headerContent}
                  onChange={(e) => setHeaderContent(e.target.value)}
                  maxLength={60}
                />
              )}

              {headerType === 'image' && (
                <div className="stack">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                  <div className="row">
                    <input
                      type="url"
                      placeholder="Image URL (https://...) or upload below"
                      value={headerContent.startsWith('data:') ? 'Image uploaded' : headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                    />
                    <button type="button" className="btn sm" onClick={() => fileInputRef.current?.click()}>
                      Upload File
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Body Section */}
            <div className="field">
              <div className="row spread">
                <span style={{ fontWeight: 600, fontSize: 13 }}>Template Body (Required)</span>
                <span className="hint">Supports {'{{name}}'}, bold, & emojis</span>
              </div>
              <WhatsAppToolbar
                textareaRef={textareaRef}
                text={body}
                setText={setBody}
                showVariable
                variableName="{{name}}"
              />
              <textarea
                ref={textareaRef}
                required
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your template body text here…"
              />
            </div>

            {/* Footer Section */}
            <label className="field">
              <span style={{ fontWeight: 600, fontSize: 13 }}>Template Footer (Optional)</span>
              <input
                placeholder="Small disclaimer or signature (e.g. Reply STOP to opt out)"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                maxLength={90}
              />
            </label>

            {/* Interactive Buttons Builder */}
            <div className="card attachment-card">
              <div className="row spread" style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Buttons (Up to 3)</span>
                {buttons.length < 3 && (
                  <button type="button" className="btn sm" onClick={addButton}>
                    + Add Button
                  </button>
                )}
              </div>

              {buttons.length === 0 ? (
                <div className="hint">No buttons added yet. Add quick replies or website links.</div>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {buttons.map((btn, idx) => (
                    <div key={idx} className="row" style={{ gap: 8 }}>
                      <select
                        style={{ width: 140 }}
                        value={btn.type}
                        onChange={(e) => updateButton(idx, { type: e.target.value as any })}
                      >
                        <option value="quick_reply">Quick Reply</option>
                        <option value="url">Website URL</option>
                        <option value="phone">Phone Number</option>
                      </select>
                      <input
                        placeholder="Button text (e.g. Visit site)"
                        value={btn.text}
                        onChange={(e) => updateButton(idx, { text: e.target.value })}
                        required
                      />
                      {btn.type !== 'quick_reply' && (
                        <input
                          placeholder={btn.type === 'url' ? 'https://example.com' : '+1234567890'}
                          value={btn.value || ''}
                          onChange={(e) => updateButton(idx, { value: e.target.value })}
                          required
                        />
                      )}
                      <button
                        type="button"
                        className="btn sm danger ghost"
                        onClick={() => removeButton(idx)}
                        title="Remove button"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live WhatsApp Phone Mockup */}
          <div className="template-preview-column">
            <div className="wa-phone-frame">
              <div className="wa-phone-notch">
                <span className="wa-phone-time">9:41</span>
                <span className="wa-phone-icons">📶 🔋</span>
              </div>
              <div className="wa-phone-header">
                <div className="wa-phone-avatar">W</div>
                <div>
                  <div className="wa-phone-name">Your Business</div>
                  <div className="wa-phone-sub">Official WhatsApp Account</div>
                </div>
              </div>
              <div className="wa-phone-chat-area">
                <div className="wa-date-pill">TODAY</div>
                <div className="wa-bubble-wrapper outbound">
                  <WhatsAppTemplateCard
                    headerType={headerType}
                    headerContent={headerContent}
                    body={previewBody}
                    footer={footer}
                    buttons={buttons}
                  />
                  <div className="wa-msg-meta">
                    <span className="wa-msg-time">10:45 AM</span>
                    <span className="wa-check-icon blue">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !name.trim() || !body.trim()}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
