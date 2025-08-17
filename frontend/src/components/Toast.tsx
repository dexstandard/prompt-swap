import { createContext, useContext, useState, ReactNode } from 'react';

interface ToastContext {
  show: (message: string) => void;
}
const Context = createContext<ToastContext>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <Context.Provider value={{ show }}>
      {children}
      {message && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow">
          {message}
        </div>
      )}
    </Context.Provider>
  );
}

export function useToast() {
  return useContext(Context);
}

