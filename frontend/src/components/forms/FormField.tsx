import type { ReactNode } from 'react';
import InfoTooltip from '../ui/InfoTooltip';

interface Props {
  label?: ReactNode;
  htmlFor?: string;
  tooltip?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function FormField({
  label,
  htmlFor,
  tooltip,
  className = '',
  children,
}: Props) {
  return (
    <div className={className}>
      {label && (
        <label
          className="block text-xs md:text-sm font-medium mb-1"
          htmlFor={htmlFor}
        >
          <span className="inline-flex items-center">
            {label}
            {tooltip && <InfoTooltip>{tooltip}</InfoTooltip>}
          </span>
        </label>
      )}
      {children}
    </div>
  );
}
