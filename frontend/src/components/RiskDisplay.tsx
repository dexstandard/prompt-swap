export default function RiskDisplay({
  risk,
  className = '',
}: {
  risk: string;
  className?: string;
}) {
  const key = risk.toLowerCase();
  const gradients: Record<string, string> = {
    low: 'linear-gradient(135deg, #4ade80, #22c55e)',
    medium: 'linear-gradient(135deg, #fde047, #eab308)',
    mid: 'linear-gradient(135deg, #fde047, #eab308)',
    high: 'linear-gradient(135deg, #f87171, #ef4444)',
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span
        className="w-4 h-4 rounded-full"
        style={{ background: gradients[key] || gradients.low }}
      />
      <span className="capitalize">{key}</span>
    </span>
  );
}

