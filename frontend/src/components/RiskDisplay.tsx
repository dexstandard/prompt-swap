import { Shield, AlertTriangle, Flame, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  low: Shield,
  medium: AlertTriangle,
  high: Flame,
};

export default function RiskDisplay({ risk, className = '' }: { risk: string; className?: string }) {
  const key = risk.toLowerCase();
  const Icon = ICONS[key];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      <span className="capitalize">{key}</span>
    </span>
  );
}
