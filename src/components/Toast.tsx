import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ToastAction {
  label: string;
  fn: () => void;
}
interface ToastItem {
  id: number;
  msg: string;
  action?: ToastAction;
}
interface ToastCtx {
  push: (msg: string, action?: ToastAction) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const push = useCallback((msg: string, action?: ToastAction) => {
    const id = idRef.current++;
    setItems((prev) => [...prev.slice(-2), { id, msg, action }]);
    window.setTimeout(
      () => setItems((prev) => prev.filter((i) => i.id !== id)),
      action ? 6000 : 3200,
    );
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((it) => (
          <div className="toast" key={it.id}>
            <span className="toast-msg">{it.msg}</span>
            {it.action && (
              <button
                type="button"
                className="toast-btn"
                onClick={() => {
                  it.action!.fn();
                  dismiss(it.id);
                }}
              >
                {it.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
