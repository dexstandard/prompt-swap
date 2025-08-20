import RiskDisplay from './RiskDisplay';
import TokenDisplay from './TokenDisplay';
import EditableText from './EditableText';

interface StrategyData {
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
}

interface Props {
  data: StrategyData;
  onChange: <K extends keyof StrategyData>(key: K, value: StrategyData[K]) => void;
}

const reviewIntervalMap: Record<string, string> = {
  '1h': '1 Hour',
  '3h': '3 Hours',
  '5h': '5 Hours',
  '12h': '12 Hours',
  '24h': '1 Day',
  '3d': '3 Days',
  '1w': '1 Week',
};

export default function AgentStrategy({ data, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1">
        <strong>Tokens:</strong>
        <EditableText
          value={data.tokenA}
          onChange={(v) => onChange('tokenA', v.toUpperCase())}
          renderDisplay={(v) => <TokenDisplay token={v} />}
        />
        <span>/</span>
        <EditableText
          value={data.tokenB}
          onChange={(v) => onChange('tokenB', v.toUpperCase())}
          renderDisplay={(v) => <TokenDisplay token={v} />}
        />
      </p>
      <p>
        <strong>Target Allocation:</strong>{' '}
        <EditableText
          value={String(data.targetAllocation)}
          onChange={(v) => onChange('targetAllocation', Number(v))}
        />
        {' / '}
        {100 - data.targetAllocation}
      </p>
      <p>
        <strong>Minimum {data.tokenA.toUpperCase()} Allocation:</strong>{' '}
        <EditableText
          value={String(data.minTokenAAllocation)}
          onChange={(v) => onChange('minTokenAAllocation', Number(v))}
        />
        %
      </p>
      <p>
        <strong>Minimum {data.tokenB.toUpperCase()} Allocation:</strong>{' '}
        <EditableText
          value={String(data.minTokenBAllocation)}
          onChange={(v) => onChange('minTokenBAllocation', Number(v))}
        />
        %
      </p>
      <p className="flex items-center gap-1">
        <strong>Risk Tolerance:</strong>{' '}
        <EditableText
          value={data.risk}
          onChange={(v) => onChange('risk', v)}
          renderDisplay={(v) => <RiskDisplay risk={v as any} />}
        />
      </p>
      <p>
        <strong>Review Interval:</strong>{' '}
        <EditableText
          value={data.reviewInterval}
          onChange={(v) => onChange('reviewInterval', v)}
          renderDisplay={(v) => reviewIntervalMap[v] ?? v}
        />
      </p>
    </div>
  );
}

