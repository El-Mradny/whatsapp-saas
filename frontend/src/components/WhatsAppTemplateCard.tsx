import { FC } from 'react';
import { TemplateButton, TemplateHeaderType } from '../api';
import { formatWhatsAppText } from './WhatsAppComposer';

interface WhatsAppTemplateCardProps {
  headerType?: TemplateHeaderType;
  headerContent?: string | null;
  body: string;
  footer?: string | null;
  buttons?: TemplateButton[];
  compact?: boolean;
  onButtonClick?: (btn: TemplateButton) => void;
}

export const WhatsAppTemplateCard: FC<WhatsAppTemplateCardProps> = ({
  headerType = 'none',
  headerContent,
  body,
  footer,
  buttons = [],
  compact = false,
  onButtonClick,
}) => {
  return (
    <div className={`wa-template-card${compact ? ' compact' : ''}`}>
      {/* Header */}
      {headerType === 'image' && headerContent && (
        <div className="wa-tpl-header-image">
          <img src={headerContent} alt="Template Header" />
        </div>
      )}

      {headerType === 'text' && headerContent && (
        <div className="wa-tpl-header-text">
          <b>{headerContent}</b>
        </div>
      )}

      {/* Body */}
      <div className="wa-tpl-body">
        {formatWhatsAppText(body) || <span className="muted">Empty template body</span>}
      </div>

      {/* Footer */}
      {footer && (
        <div className="wa-tpl-footer">
          <span>{footer}</span>
        </div>
      )}

      {/* Buttons */}
      {buttons && buttons.length > 0 && (
        <div className="wa-tpl-buttons">
          {buttons.map((btn, idx) => (
            <button
              key={`${btn.text}-${idx}`}
              type="button"
              className="wa-tpl-btn"
              onClick={() => onButtonClick?.(btn)}
            >
              {btn.type === 'url' && <span className="wa-btn-icon">🔗</span>}
              {btn.type === 'phone' && <span className="wa-btn-icon">📞</span>}
              {btn.type === 'quick_reply' && <span className="wa-btn-icon">↩</span>}
              <span className="wa-btn-text">{btn.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
