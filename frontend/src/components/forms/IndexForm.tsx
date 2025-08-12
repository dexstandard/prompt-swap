import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z
  .object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenB: z.string().min(1, 'Token B is required'),
    tokenAPercent: z
      .coerce.number()
      .min(1, 'Must be at least 1')
      .max(100, 'Must be 100 or less'),
    tokenBPercent: z
      .coerce.number()
      .min(1, 'Must be at least 1')
      .max(100, 'Must be 100 or less'),
    risk: z.enum(['low', 'medium', 'high']),
    rebalance: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
  })
  .refine((data) => data.tokenA !== data.tokenB, {
    message: 'Tokens must be different',
    path: ['tokenB'],
  })
  .refine((data) => data.tokenAPercent + data.tokenBPercent === 100, {
    message: 'Percentages must total 100',
    path: ['tokenBPercent'],
  });

type FormValues = z.infer<typeof schema>;

const tokens = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'sol', label: 'SOL' },
  { value: 'usdt', label: 'USDT' },
];

export default function IndexForm() {
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tokenA: '',
      tokenB: '',
      tokenAPercent: 50,
      tokenBPercent: 50,
      risk: 'low',
      rebalance: '1h',
    },
  });

  const onSubmit = handleSubmit((values) => {
    console.log(values);
  });

  return (
    <form onSubmit={onSubmit} className="bg-white shadow-md rounded p-6 space-y-4">
      <h2 className="text-xl font-bold">Create Index</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenA">
            Token A
          </label>
          <select id="tokenA" {...register('tokenA')} className="w-full border rounded p-2">
            <option value="" disabled>
              Select a token
            </option>
            {tokens.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenAPercent">
            % Token A
          </label>
          <input
            id="tokenAPercent"
            type="number"
            {...register('tokenAPercent', { valueAsNumber: true })}
            className="w-full border rounded p-2"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenB">
            Token B
          </label>
          <select id="tokenB" {...register('tokenB')} className="w-full border rounded p-2">
            <option value="" disabled>
              Select a token
            </option>
            {tokens.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenBPercent">
            % Token B
          </label>
          <input
            id="tokenBPercent"
            type="number"
            {...register('tokenBPercent', { valueAsNumber: true })}
            className="w-full border rounded p-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="risk">
          Risk
        </label>
        <select id="risk" {...register('risk')} className="w-full border rounded p-2">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="rebalance">
          Rebalance Frequency
        </label>
        <select
          id="rebalance"
          {...register('rebalance')}
          className="w-full border rounded p-2"
        >
          <option value="1h">1h</option>
          <option value="3h">3h</option>
          <option value="5h">5h</option>
          <option value="12h">12h</option>
          <option value="24h">24h</option>
          <option value="3d">3d</option>
          <option value="1w">1w</option>
        </select>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
        Save
      </button>
    </form>
  );
}
