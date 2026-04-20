import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react';
import { healthCheck } from '../api/client';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  connected: boolean;
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType>({
  connected: false,
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const check = async () => {
      try {
        const res = await healthCheck();
        setConnected(res.status === 'ok');
      } catch {
        setConnected(false);
      }
    };
    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppContext.Provider value={{ connected, toasts, addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <span style={{ color: 'var(--neural-400)' }}>✓</span>}
            {toast.type === 'error' && <span style={{ color: 'var(--danger-400)' }}>✕</span>}
            {toast.type === 'info' && <span style={{ color: 'var(--synapse-400)' }}>●</span>}
            <span>{toast.message}</span>
            <button
              className="btn-ghost btn-icon btn-sm"
              style={{ marginLeft: 'auto', padding: 2 }}
              onClick={() => removeToast(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
