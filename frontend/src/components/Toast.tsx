import { useState, type ReactNode } from 'react';
import { ToastContext } from '../lib/useToast';
import { ERROR_MESSAGES, ERROR_MESSAGE_PREFIXES } from '../lib/errorMessages';
import { useTranslation } from '../lib/i18n';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<
    { message: string; variant: 'error' | 'success' } | null
  >(null);
  const t = useTranslation();

  const show = (msg: string, variant: 'error' | 'success' = 'error') => {
    const key =
      ERROR_MESSAGES[msg] ||
      Object.entries(ERROR_MESSAGE_PREFIXES).find(([p]) =>
        msg.startsWith(p),
      )?.[1];
    const message = key ? t(key) : msg;
    setToast({ message, variant });
    setTimeout(() => setToast(null), 4500);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 rounded shadow ${
            toast.variant === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.message.charAt(0).toUpperCase() + toast.message.slice(1)}
        </div>
      )}
    </ToastContext.Provider>
  );
}

