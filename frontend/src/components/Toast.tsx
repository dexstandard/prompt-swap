import { createContext, useContext, useState, type ReactNode } from 'react';

interface ToastContext {
  show: (message: string, variant?: 'error' | 'success') => void;
}
const Context = createContext<ToastContext>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<
    { message: string; variant: 'error' | 'success' } | null
  >(null);

  const show = (msg: string, variant: 'error' | 'success' = 'error') => {
    setToast({ message: msg, variant });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <Context.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 rounded shadow ${
            toast.variant === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </Context.Provider>
  );
}

export function useToast() {
  return useContext(Context);
}

