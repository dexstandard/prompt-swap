export default function RiskDisplay({
  risk,
  className = '',
}: {
  risk: string;
  className?: string;
}) {
  const key = risk.toLowerCase();
  const colors: Record<string, string> = {
    low: '#16a34a',
    medium: '#d97706',
    mid: '#d97706',
    high: '#dc2626',
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: colors[key] || colors.low }}
      />
      <span className="capitalize">{key}</span>
    </span>
  );
}

