import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, Conversation, Msg, WaNumber } from '../api';
import { Empty, ErrorNote, fmtDate, useLoad, usePolling } from '../components/ui';

const SOURCE_LABEL: Record<Msg['source'], string> = { manual: 'You', campaign: 'Campaign', ai: 'AI', contact: '' };

export default function Inbox() {
  const numbers = useLoad(() => api.get<WaNumber[]>('/numbers'));
  const [numberId, setNumberId] = useState('');
  const convos = useLoad(() => api.get<Conversation[]>(`/inbox/conversations/${numberId ? `?numberId=${numberId}` : ''}`), [numberId]);
  const [active, setActive] = useState<Conversation | null>(null);
  usePolling(() => convos.reload(true), 6000);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p>Replies from your contacts, across all numbers.</p>
        </div>
        <select style={{ width: 220 }} value={numberId} onChange={(e) => { setNumberId(e.target.value); setActive(null); }} aria-label="Filter by number">
          <option value="">All numbers</option>
          {(numbers.data ?? []).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </div>
      <ErrorNote error={convos.error} />

      <div className="card flush inbox">
        <div className="inbox-list">
          {!convos.data?.length ? (
            <Empty title="No conversations">Messages appear here when contacts reply or you send campaigns.</Empty>
          ) : (
            convos.data.map((c) => {
              const isActive = active?.chatId === c.chatId && active?.numberId === c.numberId;
              return (
                <button key={`${c.numberId}:${c.chatId}`} className={`convo${isActive ? ' active' : ''}`} onClick={() => setActive(c)}>
                  <div className="row spread">
                    <b>{c.name}</b>
                    {c.unanswered && <span className="badge warn">Awaiting reply</span>}
                  </div>
                  <div className="snippet">{c.lastDirection === 'out' ? 'You: ' : ''}{c.lastMessage}</div>
                </button>
              );
            })
          )}
        </div>
        {active ? (
          <Thread key={`${active.numberId}:${active.chatId}`} convo={active} number={numbers.data?.find((n) => n.id === active.numberId)} onSent={() => convos.reload(true)} />
        ) : (
          <div className="thread"><Empty title="Select a conversation" /></div>
        )}
      </div>
    </div>
  );
}

function Thread({ convo, number, onSent }: { convo: Conversation; number?: WaNumber; onSent: () => void }) {
  const { data, error, reload } = useLoad(() => api.get<Msg[]>(`/inbox/thread/${convo.numberId}/${convo.chatId}`), [convo.numberId, convo.chatId]);
  usePolling(() => reload(true), 4000);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [data?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post('/inbox/reply', { numberId: convo.numberId, chatId: convo.chatId, text });
      setText('');
      await reload(true);
      onSent();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    setErr(null);
    try {
      setText((await api.post<{ text: string }>('/inbox/suggest', { numberId: convo.numberId, chatId: convo.chatId })).text);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="thread">
      <div className="thread-head">
        <b>{convo.name}</b> <span className="muted mono">+{convo.chatId}</span>
        {number && <span className="muted"> · via {number.label}</span>}
      </div>
      <div className="thread-body">
        <ErrorNote error={error} />
        {data?.map((m) => (
          <div key={m.id} className={`bubble ${m.direction}`}>
            {m.body}
            <span className="meta">
              {SOURCE_LABEL[m.source] && `${SOURCE_LABEL[m.source]} · `}
              {fmtDate(m.createdAt)}
            </span>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={send}>
        <ErrorNote error={err} />
        <textarea
          placeholder="Write a reply…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e as unknown as FormEvent);
          }}
        />
        <div className="row spread">
          <button type="button" className="btn sm" onClick={suggest} disabled={suggesting}>
            {suggesting ? 'Thinking…' : '✦ Suggest reply with AI'}
          </button>
          <button className="btn primary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </div>
  );
}
