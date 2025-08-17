import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

export default function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <span className="relative ml-1 cursor-pointer group" tabIndex={0}>
      <Info className="w-4 h-4 text-gray-500" />
      <span className="absolute z-10 hidden w-48 -translate-x-1/2 left-1/2 -translate-y-full mb-1 rounded bg-gray-800 p-2 text-xs text-white group-hover:block group-focus:block">
        {children}
      </span>
    </span>
  );
}
