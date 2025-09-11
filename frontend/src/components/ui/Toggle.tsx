import type { ChangeEvent } from 'react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelPosition?: 'left' | 'top';
}

export default function Toggle({
  label,
  checked,
  onChange,
  labelPosition = 'left',
}: ToggleProps) {
  const flexClass =
    labelPosition === 'top' ? 'flex flex-col items-center' : 'flex items-center';
  const marginClass = labelPosition === 'top' ? 'mt-2' : 'ml-2';

  return (
    <label className={`${flexClass} text-sm cursor-pointer`}>
      <span>{label}</span>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
      <div
        className={`${marginClass} relative w-10 h-5 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white`}
      />
    </label>
  );
}
