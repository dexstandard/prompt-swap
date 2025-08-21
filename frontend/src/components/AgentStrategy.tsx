import RiskDisplay from './RiskDisplay';
import TokenDisplay from './TokenDisplay';
import EditableText from './EditableText';
import TokenSelect from './forms/TokenSelect';
import SelectInput from './forms/SelectInput';

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

const tokens = [
  { value: 'BTC' },
  { value: 'ETH' },
  { value: 'SOL' },
  { value: 'USDT' },
];

const riskOptions = [
  { value: 'low', label: <RiskDisplay risk="low" /> },
  { value: 'medium', label: <RiskDisplay risk="medium" /> },
  { value: 'high', label: <RiskDisplay risk="high" /> },
];

const reviewIntervalOptions = [
  { value: '1h', label: '1 Hour' },
  { value: '3h', label: '3 Hours' },
  { value: '5h', label: '5 Hours' },
  { value: '12h', label: '12 Hours' },
  { value: '24h', label: '1 Day' },
  { value: '3d', label: '3 Days' },
  { value: '1w', label: '1 Week' },
];

export default function AgentStrategy({ data, onChange }: Props) {
  const labelClass = 'w-40 font-semibold';
  return (
    <dl className="space-y-2">
      <div className="flex items-center gap-2">
        <dt className={labelClass}>Tokens:</dt>
        <dd className="flex items-center gap-1">
          <EditableText
            value={data.tokenA}
            onChange={(v) => onChange('tokenA', v)}
            className="min-w-[4rem]"
            textClassName="px-0"
            renderDisplay={(v) => <TokenDisplay token={v} />}
            renderEditor={(local, setLocal, finish) => (
              <div className="w-28">
                <TokenSelect
                  id="tokenA"
                  value={local}
                  onChange={(v) => {
                    setLocal(v);
                    finish();
                  }}
                  options={tokens.filter(
                    (t) => t.value === data.tokenA || t.value !== data.tokenB
                  )}
                />
              </div>
            )}
          />
          <span>/</span>
          <EditableText
            value={data.tokenB}
            onChange={(v) => onChange('tokenB', v)}
            className="min-w-[4rem]"
            textClassName="px-0"
            renderDisplay={(v) => <TokenDisplay token={v} />}
            renderEditor={(local, setLocal, finish) => (
              <div className="w-28">
                <TokenSelect
                  id="tokenB"
                  value={local}
                  onChange={(v) => {
                    setLocal(v);
                    finish();
                  }}
                  options={tokens.filter(
                    (t) => t.value === data.tokenB || t.value !== data.tokenA
                  )}
                />
              </div>
            )}
          />
        </dd>
      </div>

      <div className="flex items-center gap-2">
        <dt className={labelClass}>Target Allocation:</dt>
        <dd>
          <EditableText
            value={String(data.targetAllocation)}
            onChange={(v) => onChange('targetAllocation', Number(v))}
            textClassName="p-0"
            renderDisplay={(v) => (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span>
                  {v}% {data.tokenA.toUpperCase()}
                </span>
                <span>/</span>
                <span>
                  {100 - Number(v)}% {data.tokenB.toUpperCase()}
                </span>
              </span>
            )}
            renderEditor={(local, setLocal, finish) => (
              <span className="flex items-center gap-2 w-64">
                <span className="whitespace-nowrap">
                  {local}% {data.tokenA.toUpperCase()}
                </span>
                <input
                  type="range"
                  min={data.minTokenAAllocation}
                  max={100 - data.minTokenBAllocation}
                  value={Number(local)}
                  onChange={(e) => setLocal(e.target.value)}
                  onMouseUp={finish}
                  onBlur={finish}
                  className="flex-1"
                />
                <span className="whitespace-nowrap">
                  {100 - Number(local)}% {data.tokenB.toUpperCase()}
                </span>
              </span>
            )}
          />
        </dd>
      </div>

      <div className="flex items-center gap-2">
        <dt className={labelClass}>Min {data.tokenA.toUpperCase()} Allocation:</dt>
        <dd>
          <EditableText
            value={String(data.minTokenAAllocation)}
            onChange={(v) => onChange('minTokenAAllocation', Number(v))}
            className="w-16"
            textClassName="px-0 text-right"
            renderDisplay={(v) => `${v}%`}
          />
        </dd>
      </div>

      <div className="flex items-center gap-2">
        <dt className={labelClass}>Min {data.tokenB.toUpperCase()} Allocation:</dt>
        <dd>
          <EditableText
            value={String(data.minTokenBAllocation)}
            onChange={(v) => onChange('minTokenBAllocation', Number(v))}
            className="w-16"
            textClassName="px-0 text-right"
            renderDisplay={(v) => `${v}%`}
          />
        </dd>
      </div>

      <div className="flex items-center gap-2">
        <dt className={labelClass}>Risk Tolerance:</dt>
        <dd>
          <EditableText
            value={data.risk}
            onChange={(v) => onChange('risk', v)}
            className="w-32 h-8"
            textClassName="w-full px-0 flex items-center h-full"
            renderDisplay={(v) => <RiskDisplay risk={v as any} />}
            renderEditor={(local, setLocal, finish) => (
              <SelectInput
                id="risk"
                value={local}
                onChange={(v) => {
                  setLocal(v);
                  finish();
                }}
                options={riskOptions}
                className="h-full"
              />
            )}
          />
        </dd>
      </div>

      <div className="flex items-center gap-2">
        <dt className={labelClass}>Review Interval:</dt>
        <dd>
          <EditableText
            value={data.reviewInterval}
            onChange={(v) => onChange('reviewInterval', v)}
            className="w-32 h-8"
            textClassName="w-full px-0 flex items-center h-full"
            renderDisplay={(v) => reviewIntervalMap[v] ?? v}
            renderEditor={(local, setLocal, finish) => (
              <SelectInput
                id="reviewInterval"
                value={local}
                onChange={(v) => {
                  setLocal(v);
                  finish();
                }}
                options={reviewIntervalOptions}
                className="h-full"
              />
            )}
          />
        </dd>
      </div>
    </dl>
  );
}
