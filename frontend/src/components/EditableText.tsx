import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  renderDisplay?: (value: string) => ReactNode;
  className?: string;
  textClassName?: string;
}

export default function EditableText({
  value,
  onChange,
  renderDisplay,
  className = '',
  textClassName = '',
}: Props) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {editing ? (
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onChange(local);
          }}
          className={`px-1 border-b border-gray-300 bg-transparent focus:outline-none ${textClassName}`}
        />
      ) : (
        <span className={`px-1 ${textClassName}`}>
          {renderDisplay ? renderDisplay(value) : value}
        </span>
      )}
      <Pencil
        className="w-4 h-4 text-gray-500 cursor-pointer"
        onClick={() => setEditing(true)}
      />
    </span>
  );
}

