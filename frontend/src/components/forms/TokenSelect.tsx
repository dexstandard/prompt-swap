import {useState} from 'react';
import Token from '../Token';

export type TokenSelectProps = {
  value: string;
  onChange: (value: string) => void;
  tokens: string[];
  id?: string;
};

export default function TokenSelect({value, onChange, tokens, id}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" tabIndex={0} onBlur={() => setOpen(false)}>
      <button
        type="button"
        id={id}
        className="w-full border rounded p-2 flex items-center gap-2 bg-white"
        onClick={() => setOpen(!open)}
      >
        <Token symbol={value} />
      </button>
      {open && (
        <ul className="absolute z-10 bg-white border rounded mt-1 w-full max-h-48 overflow-auto">
          {tokens.map((t) => (
            <li
              key={t}
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
            >
              <Token symbol={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
