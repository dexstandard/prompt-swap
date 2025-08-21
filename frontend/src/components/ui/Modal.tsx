import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-4 rounded shadow max-w-lg w-full relative">
        {children}
        <button
          type="button"
          className="absolute top-2 right-2 text-gray-600"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}
