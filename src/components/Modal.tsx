import { useEffect, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Overlay, Panel } from './Motion';

export function Modal({
  title,
  body,
  confirmLabel = '确认',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); onCancel(); } };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [onCancel]);
  return (
    <Overlay className="modal-overlay" onClick={onCancel}>
      <Panel className="modal" label={title}>
        <div className="modal-icon-wrap">
          <AlertTriangle size={22} />
        </div>
        <h3 className="modal-title">{title}</h3>
        {body && <div className="modal-body">{body}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </Panel>
    </Overlay>
  );
}
