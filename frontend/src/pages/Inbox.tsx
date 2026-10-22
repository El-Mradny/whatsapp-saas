import { ChangeEvent, SubmitEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, Contact, Conversation, Msg, Template, WaNumber } from '../api';
import { ErrorNote, Modal, useLoad, usePolling } from '../components/ui';
import { EMOJI_CATEGORIES, formatWhatsAppText } from '../components/WhatsAppComposer';

const AVATAR_COLORS = [
  '#00a884',
  '#027eb5',
  '#6b5ce7',
  '#d98324',
  '#e15f41',
  '#20bf6b',
  '#0984e3',
  '#e84393',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index]!;
}

function formatChatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function formatMessageTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  ) {
    return 'TODAY';
  }
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return 'YESTERDAY';
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export default function Inbox() {
  const numbers = useLoad(() => api.get<WaNumber[]>('/numbers'));
  const contacts = useLoad(() => api.get<Contact[]>('/contacts'));
  const [numberId, setNumberId] = useState('');
  const convos = useLoad(() => api.get<Conversation[]>(`/inbox/conversations/${numberId ? `?numberId=${numberId}` : ''}`), [numberId]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatNumberId, setNewChatNumberId] = useState('');

  usePolling(() => convos.reload(true), 6000);

  // Filter conversations by contact name, phone, or last message
  const filteredConvos = useMemo(() => {
    const list = convos.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.chatId.includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)),
    );
  }, [convos.data, searchQuery]);

  // Auto-select first conversation if none selected initially
  useEffect(() => {
    if (!active && filteredConvos.length > 0) {
      setActive(filteredConvos[0]!);
    }
  }, [filteredConvos, active]);

  // Start new chat with phone and optional name
  const startChatWith = (phone: string, name?: string) => {
    const clean = phone.replace(/[^0-9]/g, '');
    if (!clean) return;
    const defaultNumber = newChatNumberId || numberId || numbers.data?.[0]?.id || '';
    const newConvo: Conversation = {
      numberId: defaultNumber,
      chatId: clean,
      name: name?.trim() || clean,
      lastMessage: '',
      lastDirection: 'out',
      lastAt: new Date().toISOString(),
      unanswered: false,
    };
    setActive(newConvo);
    setShowNewChat(false);
    setSearchQuery('');
  };

  // Filter contacts for New Chat modal
  const filteredContacts = useMemo(() => {
    const list = contacts.data ?? [];
    if (!newChatSearch.trim()) return list;
    const q = newChatSearch.toLowerCase();
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [contacts.data, newChatSearch]);

  const isNewChatSearchPhone = useMemo(() => {
    const clean = newChatSearch.replace(/[^0-9]/g, '');
    return clean.length >= 7;
  }, [newChatSearch]);

  return (
    <div className="wa-inbox-app">
      {/* WhatsApp Web Container */}
      <div className="wa-web-container">
        {/* Left Side: WhatsApp Chats List */}
        <aside className="wa-side-panel">
          {/* Top Bar with User Avatar, Number Filter & New Chat */}
          <div className="wa-side-header">
            <div className="wa-user-avatar" title="Your WhatsApp Account">
              <span>WA</span>
            </div>
            <div className="wa-side-header-actions">
              <select
                className="wa-number-select"
                value={numberId}
                onChange={(e) => {
                  setNumberId(e.target.value);
                  setActive(null);
                }}
                title="Filter by WhatsApp Number"
              >
                <option value="">All numbers</option>
                {(numbers.data ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="wa-new-chat-btn"
                onClick={() => {
                  setNewChatSearch('');
                  setShowNewChat(true);
                }}
                title="Start a new chat"
              >
                <span>➕</span> New Chat
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="wa-search-bar-wrap">
            <div className="wa-search-pill">
              <span className="wa-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wa-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <ErrorNote error={convos.error} />

          {/* Quick action to start chat with entered search term if no exact matches */}
          {searchQuery.trim().length >= 5 && (
            <div
              className="wa-start-chat-query-btn"
              onClick={() => startChatWith(searchQuery, searchQuery)}
            >
              💬 Start new chat with "{searchQuery}"
            </div>
          )}

          {/* Chat List Scroll */}
          <div className="wa-chat-list">
            {!filteredConvos.length ? (
              <div className="wa-empty-chats">
                <span style={{ fontSize: 36 }}>💬</span>
                <p>{searchQuery ? 'No chats match your search' : 'No conversations yet'}</p>
                <span className="hint">
                  Click below to message any contact or enter a WhatsApp number.
                </span>
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={() => {
                      setNewChatSearch('');
                      setShowNewChat(true);
                    }}
                  >
                    + Start New Chat
                  </button>
                </div>
              </div>
            ) : (
              filteredConvos.map((c) => {
                const isActive = active?.chatId === c.chatId && active?.numberId === c.numberId;
                const initial = c.name ? c.name[0]?.toUpperCase() : '?';
                const avatarBg = getAvatarColor(c.name || c.chatId);

                return (
                  <div
                    key={`${c.numberId}:${c.chatId}`}
                    className={`wa-chat-item${isActive ? ' active' : ''}`}
                    onClick={() => setActive(c)}
                  >
                    <div className="wa-chat-avatar" style={{ backgroundColor: avatarBg }}>
                      {initial}
                    </div>
                    <div className="wa-chat-info">
                      <div className="wa-chat-title-row">
                        <span className="wa-chat-name" title={c.name}>
                          {c.name}
                        </span>
                        <span className="wa-chat-date mono">
                          {formatChatTime(c.lastAt)}
                        </span>
                      </div>
                      <div className="wa-chat-snippet-row">
                        <div className="wa-chat-snippet">
                          {c.lastDirection === 'out' && (
                            <span className="wa-check-icon blue" title="Delivered">
                              ✓✓
                            </span>
                          )}
                          <span className="wa-snippet-text">{c.lastMessage || '📷 Photo'}</span>
                        </div>
                        {c.unanswered && (
                          <div className="wa-unread-pill" title="Awaiting reply">
                            1
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Side: Active Conversation or WhatsApp Empty Screen */}
        <main className="wa-main-panel">
          {active ? (
            <WhatsAppThread
              key={`${active.numberId}:${active.chatId}`}
              convo={active}
              number={numbers.data?.find((n) => n.id === active.numberId)}
              onSent={() => convos.reload(true)}
            />
          ) : (
            <div className="wa-placeholder-screen">
              <div className="wa-placeholder-box">
                <div className="wa-placeholder-icon">
                  <svg viewBox="0 0 308 260" width="220" height="180" fill="none">
                    <circle cx="154" cy="130" r="100" fill="var(--brand-soft)" />
                    <path
                      d="M154 50C109.8 50 74 85.8 74 130c0 15.3 4.3 29.6 11.8 41.7L75 210l39.5-10.4c11.7 6.4 25.1 10.4 39.5 10.4 44.2 0 80-35.8 80-80s-35.8-80-80-80zm0 144.5c-12.8 0-24.8-3.6-35-9.8l-2.5-1.5-23.4 6.1 6.3-22.8-1.6-2.6c-7-11.2-10.8-24.4-10.8-37.9 0-36.6 29.9-66.5 67-66.5s67 29.9 67 66.5-30.4 68.5-67 68.5z"
                      fill="var(--brand)"
                    />
                  </svg>
                </div>
                <h2>WhatsApp Web for Business</h2>
                <p>
                  Send and receive messages seamlessly across connected WhatsApp numbers with rich formatting, photos, emojis, and professional templates.
                </p>
                <div style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      setNewChatSearch('');
                      setShowNewChat(true);
                    }}
                  >
                    💬 Start a New Chat
                  </button>
                </div>
                <div className="wa-placeholder-encrypted" style={{ marginTop: 24 }}>
                  🔒 End-to-end encrypted messaging gateway
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Start New Chat Modal */}
      {showNewChat && (
        <Modal title="Start New Conversation" onClose={() => setShowNewChat(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Sender Number Selector */}
            {(numbers.data ?? []).length > 1 && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Send via WhatsApp Number:
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={newChatNumberId || numberId || numbers.data?.[0]?.id || ''}
                  onChange={(e) => setNewChatNumberId(e.target.value)}
                >
                  {(numbers.data ?? []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.phone ? `+${n.phone}` : n.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Contact or Phone Number:
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                placeholder="Search contact name or enter +phone number…"
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Direct Number Action */}
            {isNewChatSearchPhone && (
              <div
                className="wa-start-chat-query-btn"
                style={{ margin: '0 0 6px 0' }}
                onClick={() => startChatWith(newChatSearch, newChatSearch)}
              >
                💬 Chat with +{newChatSearch.replace(/[^0-9]/g, '')}
              </div>
            )}

            {/* Contact List */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              Contacts ({filteredContacts.length})
            </div>

            <div className="wa-contact-picker-list">
              {!filteredContacts.length ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)' }}>
                  No contacts found. Type a phone number above to message directly.
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const initial = c.name ? c.name[0]?.toUpperCase() : '?';
                  const avatarBg = getAvatarColor(c.name || c.phone);
                  return (
                    <div
                      key={c.id}
                      className="wa-contact-picker-item"
                      onClick={() => startChatWith(c.phone, c.name)}
                    >
                      <div className="wa-contact-picker-avatar" style={{ backgroundColor: avatarBg }}>
                        {initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="wa-contact-picker-name">{c.name}</div>
                        <div className="wa-contact-picker-phone">+{c.phone}</div>
                      </div>
                      <span className="btn sm">Chat</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WhatsAppThread({
  convo,
  number,
  onSent,
}: {
  convo: Conversation;
  number?: WaNumber;
  onSent: () => void;
}) {
  const { data, error, reload } = useLoad(
    () => api.get<Msg[]>(`/inbox/thread/${convo.numberId}/${convo.chatId}`),
    [convo.numberId, convo.chatId],
  );
  const templates = useLoad(() => api.get<Template[]>('/templates'));
  usePolling(() => reload(true), 4000);

  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Popover States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCat, setSelectedEmojiCat] = useState(0);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadBodyRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const tplPickerRef = useRef<HTMLDivElement>(null);

  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Smooth or instant scroll to the newest message
  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (threadBodyRef.current) {
      threadBodyRef.current.scrollTop = threadBodyRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const handleChatScroll = () => {
    if (!threadBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = threadBodyRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    setShowScrollBottomBtn(distanceToBottom > 140);
  };

  // Close emoji popover on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  // Close template picker on click outside
  useEffect(() => {
    if (!showTemplatesPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (tplPickerRef.current && !tplPickerRef.current.contains(e.target as Node)) {
        setShowTemplatesPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTemplatesPicker]);

  // Scroll to bottom internally whenever messages load
  useEffect(() => {
    scrollToBottom('auto');
    const t1 = setTimeout(() => scrollToBottom('auto'), 60);
    const t2 = setTimeout(() => scrollToBottom('auto'), 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data?.length, convo.chatId]);

  // Handle Photo selection from device
  const handleImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setMediaUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Insert emoji or text snippet at cursor position
  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + snippet);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + snippet + text.slice(end);
    setText(next);
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  // Wrap current selection with WhatsApp Markdown syntax (*bold*, _italic_, ~strike~, ```code```)
  const wrapSelection = (prefix: string, suffix: string, defaultText: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + prefix + defaultText + suffix);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    const content = selected || defaultText;
    const replacement = `${prefix}${content}${suffix}`;
    const next = text.slice(0, start) + replacement + text.slice(end);
    setText(next);

    setTimeout(() => {
      el.focus();
      const newCursorPos = selected ? start + replacement.length : start + prefix.length;
      const selectEnd = selected ? newCursorPos : newCursorPos + defaultText.length;
      el.setSelectionRange(newCursorPos, selectEnd);
    }, 0);
  };

  // Apply rich template into composer
  const applyTemplateToComposer = (tpl: Template) => {
    if (tpl.headerType === 'image' && tpl.headerContent) {
      setMediaUrl(tpl.headerContent);
    }
    const firstName = convo.name.split(' ')[0] || convo.name;
    const personalizedBody = tpl.body.replace(/\{\{\s*name\s*\}\}/gi, firstName);
    let full = '';
    if (tpl.headerType === 'text' && tpl.headerContent) {
      full += `*${tpl.headerContent}*\n\n`;
    }
    full += personalizedBody;
    if (tpl.footer) {
      full += `\n\n_${tpl.footer}_`;
    }
    setText(full);
    setShowTemplatesPicker(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Send message with optional photo attachment
  const send = async (e?: SubmitEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() && !mediaUrl) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post('/inbox/reply', {
        numberId: convo.numberId,
        chatId: convo.chatId,
        text: text.trim(),
        mediaUrl: mediaUrl || undefined,
      });
      setText('');
      setMediaUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload(true);
      onSent();
      setTimeout(() => scrollToBottom('smooth'), 50);
      setTimeout(() => scrollToBottom('smooth'), 220);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // AI Reply Suggestion
  const suggest = async () => {
    setSuggesting(true);
    setErr(null);
    try {
      const res = await api.post<{ text: string }>('/inbox/suggest', {
        numberId: convo.numberId,
        chatId: convo.chatId,
      });
      setText(res.text);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  // Filtered Emojis for picker
  const filteredEmojis = useMemo(() => {
    if (emojiSearch.trim()) {
      return EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, i, arr) => arr.indexOf(emoji) === i);
    }
    return EMOJI_CATEGORIES[selectedEmojiCat]?.emojis ?? [];
  }, [emojiSearch, selectedEmojiCat]);

  // Group messages by day for WhatsApp date separator pills
  const groupedMessages = useMemo(() => {
    const msgs = data ?? [];
    const groups: { day: string; messages: Msg[] }[] = [];
    let currentDay = '';
    let currentList: Msg[] = [];

    for (const m of msgs) {
      const day = getDayLabel(m.createdAt);
      if (day !== currentDay) {
        if (currentList.length) {
          groups.push({ day: currentDay, messages: currentList });
        }
        currentDay = day;
        currentList = [m];
      } else {
        currentList.push(m);
      }
    }
    if (currentList.length) {
      groups.push({ day: currentDay, messages: currentList });
    }
    return groups;
  }, [data]);

  const initial = convo.name ? convo.name[0]?.toUpperCase() : '?';
  const avatarBg = getAvatarColor(convo.name || convo.chatId);

  return (
    <div className="wa-thread-panel">
      {/* WhatsApp Thread Header */}
      <div className="wa-thread-header">
        <div className="wa-thread-user">
          <div className="wa-chat-avatar" style={{ backgroundColor: avatarBg }}>
            {initial}
          </div>
          <div className="wa-thread-user-meta">
            <span className="wa-thread-name">{convo.name}</span>
            <span className="wa-thread-status">
              +{convo.chatId} {number ? ` · via ${number.label}` : ''}
            </span>
          </div>
        </div>

        <div className="wa-thread-header-actions">
          <button
            type="button"
            className="wa-ai-suggest-btn"
            onClick={suggest}
            disabled={suggesting}
            title="Generate AI reply suggestion"
          >
            {suggesting ? 'Thinking…' : '✦ AI Suggest'}
          </button>
        </div>
      </div>

      {/* WhatsApp Chat Body with Official Doodle Background */}
      <div className="wa-chat-body" ref={threadBodyRef} onScroll={handleChatScroll}>
        <ErrorNote error={error} />

        {/* If no messages in this conversation yet */}
        {!groupedMessages.length && (
          <div className="wa-empty-thread-welcome">
            <div className="wa-empty-thread-badge">👋 New Conversation</div>
            <h3>{convo.name}</h3>
            <p>+{convo.chatId}</p>
            <span className="hint">
              Type a message below, add an emoji, or attach a photo to send your first message.
            </span>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.day} className="wa-day-group">
            <div className="wa-date-pill-wrap">
              <span className="wa-date-pill">{group.day}</span>
            </div>

            {group.messages.map((m) => {
              const isOut = m.direction === 'out';
              return (
                <div key={m.id} className={`wa-bubble-row ${isOut ? 'outbound' : 'inbound'}`}>
                  <div className={`wa-bubble ${isOut ? 'out' : 'in'}`}>
                    <span className="wa-bubble-tail" />

                    {m.mediaUrl && (
                      <div className="wa-bubble-media">
                        <img
                          src={m.mediaUrl}
                          alt="Attachment"
                          className="wa-bubble-img"
                          onLoad={() => scrollToBottom('auto')}
                          onClick={() => window.open(m.mediaUrl!, '_blank')}
                          title="Click to view full size"
                        />
                      </div>
                    )}

                    {m.body && (
                      <div className="wa-bubble-text">
                        {formatWhatsAppText(m.body)}
                      </div>
                    )}

                    <div className="wa-bubble-meta">
                      <span className="wa-bubble-time mono">{formatMessageTime(m.createdAt)}</span>
                      {isOut && <span className="wa-check-icon blue">✓✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          className="wa-scroll-bottom-btn"
          onClick={() => scrollToBottom('smooth')}
          title="Scroll to latest messages"
        >
          ↓
        </button>
      )}

      {/* WhatsApp Sticky Bottom Composer Bar */}
      <form
        className="wa-composer-bar"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <ErrorNote error={err} />

        {/* Media Preview if photo is selected */}
        {mediaUrl && (
          <div className="wa-composer-preview-bar">
            <img src={mediaUrl} alt="Attached" className="wa-composer-preview-img" />
            <div className="wa-composer-preview-info">
              <span className="wa-composer-preview-label">📷 Photo ready to send</span>
              <span className="hint" style={{ fontSize: 11 }}>Will be delivered with your message caption</span>
            </div>
            <button
              type="button"
              className="wa-composer-remove-btn"
              onClick={() => {
                setMediaUrl('');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              title="Remove photo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Micro-Toolbar: WhatsApp Markdown formatting & AI */}
        <div className="wa-composer-format-bar">
          <div className="wa-format-actions">
            <button
              type="button"
              className="wa-format-pill"
              title="Bold (*text*)"
              onClick={() => wrapSelection('*', '*', 'bold')}
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className="wa-format-pill"
              title="Italic (_text_)"
              onClick={() => wrapSelection('_', '_', 'italic')}
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className="wa-format-pill"
              title="Strikethrough (~text~)"
              onClick={() => wrapSelection('~', '~', 'strike')}
            >
              <s>S</s>
            </button>
            <button
              type="button"
              className="wa-format-pill"
              title="Monospace (```code```)"
              onClick={() => wrapSelection('```', '```', 'code')}
            >
              <code>&lt;/&gt;</code>
            </button>
            <span className="wa-format-hint">WhatsApp Markdown: *bold* _italic_ ~strike~</span>
          </div>

          <button
            type="button"
            className="wa-ai-suggest-btn"
            onClick={suggest}
            disabled={suggesting}
            title="Generate AI reply suggestion"
          >
            {suggesting ? 'Thinking…' : '✦ AI Suggest'}
          </button>
        </div>

        {/* Main WhatsApp Web Composer Row: Emoji, Attach Photo, Templates, Input Pill, Send */}
        <div className="wa-composer-input-row">
          <div className="wa-composer-actions">
            {/* 1. Emoji Picker Button & Popover */}
            <div className="wa-popover-anchor" ref={emojiPickerRef}>
              <button
                type="button"
                className={`wa-action-icon-btn ${showEmojiPicker ? 'active' : ''}`}
                title="Insert Emoji (😀)"
                onClick={() => setShowEmojiPicker((v) => !v)}
              >
                😀
              </button>

              {showEmojiPicker && (
                <div className="wa-emoji-popover">
                  <div className="wa-emoji-head">
                    <input
                      type="text"
                      placeholder="Search emoji…"
                      value={emojiSearch}
                      onChange={(e) => setEmojiSearch(e.target.value)}
                      className="input sm"
                      style={{ width: '100%' }}
                      autoFocus
                    />
                  </div>

                  {!emojiSearch.trim() && (
                    <div className="wa-emoji-tabs">
                      {EMOJI_CATEGORIES.map((c, i) => (
                        <button
                          key={c.name}
                          type="button"
                          className={`wa-emoji-tab${selectedEmojiCat === i ? ' active' : ''}`}
                          onClick={() => setSelectedEmojiCat(i)}
                          title={c.name}
                        >
                          {c.icon}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="wa-emoji-grid">
                    {filteredEmojis.map((emoji, idx) => (
                      <button
                        key={`${emoji}-${idx}`}
                        type="button"
                        className="wa-emoji-item"
                        onClick={() => {
                          insertSnippet(emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Photo Attachment (Camera / Image file) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImagePick}
            />
            <button
              type="button"
              className={`wa-action-icon-btn ${mediaUrl ? 'active' : ''}`}
              title="Attach photo (📎)"
              onClick={() => fileInputRef.current?.click()}
            >
              📎
            </button>

            {/* 3. WhatsApp Pre-built Templates Popover */}
            <div className="wa-popover-anchor" ref={tplPickerRef}>
              <button
                type="button"
                className={`wa-action-icon-btn ${showTemplatesPicker ? 'active' : ''}`}
                title="Insert WhatsApp Template (📋)"
                onClick={() => setShowTemplatesPicker((v) => !v)}
              >
                📋
              </button>

              {showTemplatesPicker && (
                <div className="wa-templates-popover">
                  <div className="wa-templates-popover-head">
                    <b>Select Template</b>
                    <span className="hint">{templates.data?.length ?? 0} templates</span>
                  </div>
                  <div className="wa-templates-popover-list">
                    {!templates.data?.length ? (
                      <div className="wa-empty-hint">No templates available. Create some under Templates.</div>
                    ) : (
                      templates.data.map((tpl) => (
                        <div
                          key={tpl.id}
                          className="wa-tpl-select-item"
                          onClick={() => applyTemplateToComposer(tpl)}
                        >
                          <div className="wa-tpl-select-name">{tpl.name}</div>
                          <div className="wa-tpl-select-snippet">
                            {tpl.headerContent ? `[${tpl.headerContent}] ` : ''}
                            {tpl.body.slice(0, 70)}…
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Text Message Input Pill (Stretches across all remaining space) */}
          <div className="wa-input-pill">
            <textarea
              ref={textareaRef}
              placeholder="Type a message"
              value={text}
              rows={1}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>

          {/* 5. Circular Green WhatsApp Send Button */}
          <button
            type="submit"
            className="wa-send-btn"
            disabled={busy || (!text.trim() && !mediaUrl)}
            title="Send (Enter)"
          >
            {busy ? (
              <span className="wa-send-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
