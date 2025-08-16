import { useState } from 'react';
import TokenDisplay from '../TokenDisplay';

interface Option {
  value: string;
}

export default function TokenSelect({
  value,
  onChange,
  options,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen(!open)}
        className="w-full border rounded px-2 py-1 flex items-center justify-between"
      >
        {selected ? (
          <TokenDisplay token={selected.value} />
        ) : (
          <span className="text-gray-500">Select a token</span>
        )}
        <span className="ml-2">▾</span>
      </button>
      {open && (
        <ul className="absolute z-10 w-full bg-white border rounded mt-1 max-h-40 overflow-auto">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className="w-full text-left px-2 py-1 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <TokenDisplay token={opt.value} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
