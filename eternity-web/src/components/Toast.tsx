import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastContextValue {
  say: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const say = useCallback((msg: string) => {
    setMessage(msg);
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 3400);
  }, []);

  return (
    <ToastContext.Provider value={{ say }}>
      {children}
      <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
        <span className="dot" />
        <p>{message}</p>
      </div>
    </ToastContext.Provider>
  );
}
