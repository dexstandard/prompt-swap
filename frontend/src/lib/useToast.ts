import { createContext, useContext } from 'react';

export interface ToastContext {
  show: (message: string, variant?: 'error' | 'success') => void;
}

export const ToastContext = createContext<ToastContext>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}
