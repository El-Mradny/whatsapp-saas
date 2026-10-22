import { FC, ReactNode, useEffect, useRef, useState } from 'react';

// Common emoji categories
export const EMOJI_CATEGORIES = [
  {
    name: 'Popular',
    icon: '⭐',
    emojis: ['👋', '😊', '👍', '❤️', '🔥', '🎉', '✨', '🚀', '💬', '📱', '🎯', '💡', '📞', '📅', '🤝', '👏', '💯', '🌟'],
  },
  {
    name: 'Faces',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '😉', '😍', '🥰', '😎', '🤔', '🥳', '🤩', '🤗', '😇', '😋', '🧐'],
  },
  {
    name: 'Hands',
    icon: '👍',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '✌️', '🤞', '👊', '✊', '🤙', '👈', '👉', '👆', '👇', '✋', '🖐️', '✍️'],
  },
  {
    name: 'Business',
    icon: '💼',
    emojis: ['📢', '🏷️', '🎁', '💰', '🛒', '📦', '📈', '💼', '✉️', '📣', '💳', '🛍️', '🔔', '💎', '⏳', '🚨', '🏆', '📌'],
  },
  {
    name: 'Symbols',
    icon: '✅',
    emojis: ['✅', '❌', '⚠️', 'ℹ️', '⚡', '⭐', '🌟', '❓', '❗', '🟢', '🔴', '🔵', '➡️', '⬅️', '⬆️', '⬇️', '🔗', '🔒'],
  },
];

export interface WhatsAppToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  text: string;
  setText: (val: string) => void;
  showVariable?: boolean;
  variableName?: string;
}

export const WhatsAppToolbar: FC<WhatsAppToolbarProps> = ({
  textareaRef,
  text,
  setText,
  showVariable = false,
  variableName = '{{name}}',
}) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedCat, setSelectedCat] = useState(0);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close emoji popover on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmoji]);

  const wrapSelection = (prefix: string, suffix: string, defaultText: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText(text + prefix + defaultText + suffix);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    const content = selected || defaultText;
    const replacement = `${prefix}${content}${suffix}`;
    const next = text.slice(0, start) + replacement + text.slice(end);
    setText(next);

    // Set cursor selection after update
    setTimeout(() => {
      el.focus();
      const newCursorPos = selected ? start + replacement.length : start + prefix.length;
      const selectEnd = selected ? newCursorPos : newCursorPos + defaultText.length;
      el.setSelectionRange(newCursorPos, selectEnd);
    }, 0);
  };

  const insertText = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText(text + snippet);
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

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, i, arr) => arr.indexOf(emoji) === i)
    : EMOJI_CATEGORIES[selectedCat]?.emojis ?? [];

  return (
    <div className="wa-toolbar">
      <div className="wa-toolbar-actions">
        <button
          type="button"
          className="wa-tool-btn wa-bold"
          title="Bold (*text*)"
          onClick={() => wrapSelection('*', '*', 'bold')}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          className="wa-tool-btn wa-italic"
          title="Italic (_text_)"
          onClick={() => wrapSelection('_', '_', 'italic')}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          className="wa-tool-btn wa-strike"
          title="Strikethrough (~text~)"
          onClick={() => wrapSelection('~', '~', 'strike')}
        >
          <s>S</s>
        </button>
        <button
          type="button"
          className="wa-tool-btn wa-mono"
          title="Monospace (```code```)"
          onClick={() => wrapSelection('```', '```', 'code')}
        >
          <code>&lt;/&gt;</code>
        </button>

        <div className="wa-emoji-wrapper" ref={popoverRef}>
          <button
            type="button"
            className={`wa-tool-btn wa-emoji-btn${showEmoji ? ' active' : ''}`}
            title="Insert Emoji"
            onClick={() => setShowEmoji((v) => !v)}
          >
            <span>😀</span>
            <span className="wa-tool-label">Emoji</span>
          </button>

          {showEmoji && (
            <div className="wa-emoji-popover">
              <div className="wa-emoji-head">
                <input
                  type="text"
                  placeholder="Search emoji…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="wa-emoji-search"
                  autoFocus
                />
              </div>

              {!search.trim() && (
                <div className="wa-emoji-tabs">
                  {EMOJI_CATEGORIES.map((c, i) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`wa-emoji-tab${selectedCat === i ? ' active' : ''}`}
                      onClick={() => setSelectedCat(i)}
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
                      insertText(emoji);
                      setShowEmoji(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showVariable && (
          <button
            type="button"
            className="wa-tool-btn wa-var-btn"
            title={`Insert ${variableName}`}
            onClick={() => insertText(variableName)}
          >
            <span>+</span> <code>{variableName}</code>
          </button>
        )}
      </div>
      <div className="wa-toolbar-hint">WhatsApp Markdown: *bold* _italic_ ~strike~</div>
    </div>
  );
};

/**
 * Parses WhatsApp formatting (*bold*, _italic_, ~strike~, ```code```, URLs, and line breaks)
 * into safe React nodes without risking XSS.
 */
export function formatWhatsAppText(raw: string): ReactNode {
  if (!raw) return null;

  // Split into lines to preserve line breaks
  const lines = raw.split('\n');

  return lines.map((line, lineIndex) => {
    return (
      <span key={`line-${lineIndex}`}>
        {parseLineFormatting(line)}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

function parseLineFormatting(text: string): ReactNode[] {
  // Regex pattern matching:
  // 1. ```monospace```
  // 2. *bold*
  // 3. _italic_
  // 4. ~strike~
  // 5. URLs (http/https)
  const pattern = /(```[\s\S]+?```|\*(?!\s)([^*]+?)(?<!\s)\*|_(?!\s)([^_]+?)(?<!\s)_|~(?!\s)([^~]+?)(?<!\s)~|https?:\/\/[^\s<]+)/g;

  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('```') && token.endsWith('```')) {
      elements.push(
        <code key={`code-${match.index}`} className="wa-inline-code">
          {token.slice(3, -3)}
        </code>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      elements.push(
        <strong key={`bold-${match.index}`} className="wa-bold-text">
          {token.slice(1, -1)}
        </strong>,
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      elements.push(
        <em key={`italic-${match.index}`} className="wa-italic-text">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('~') && token.endsWith('~')) {
      elements.push(
        <del key={`del-${match.index}`} className="wa-strike-text">
          {token.slice(1, -1)}
        </del>,
      );
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      elements.push(
        <a
          key={`link-${match.index}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="wa-link"
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </a>,
      );
    } else {
      elements.push(token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}
