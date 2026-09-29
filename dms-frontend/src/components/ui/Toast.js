// src/components/ui/Toast.js
'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const icons = { success: CheckCircle, danger: XCircle, warning: AlertCircle };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => {
          const Icon = icons[t.type] || CheckCircle;
          return (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <Icon size={16} />
              <span style={{flex:1}}>{t.message}</span>
              <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} style={{background:'none',color:'inherit',opacity:.7}}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
};
