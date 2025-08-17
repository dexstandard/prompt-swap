export default function RiskDisplay({
  risk,
  className = '',
}: {
  risk: string;
  className?: string;
}) {
  const key = risk.toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span
        className="w-4 h-4 rounded-full"
        style={{
          background:
            'linear-gradient(135deg, #22c55e, #eab308, #ef4444)',
        }}
      />
      <span className="capitalize">{key}</span>
    </span>
  );
}

