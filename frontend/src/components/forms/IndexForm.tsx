import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../lib/axios';
import { useUser } from '../../lib/user';

const schema = z
  .object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenB: z.string().min(1, 'Token B is required'),
    tokenAPercent: z
      .coerce.number()
      .min(1, 'Must be at least 1')
      .max(99, 'Must be 99 or less'),
    tokenBPercent: z
      .coerce.number()
      .min(1, 'Must be at least 1')
      .max(99, 'Must be 99 or less'),
    risk: z.enum(['low', 'medium', 'high']),
    rebalance: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    model: z.enum(['gpt-5', 'o3', 'gpt-4.1', 'gpt-4o']),
    systemPrompt: z
      .string()
      .min(1, 'System prompt is required'),
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

const models = [
  { value: 'gpt-5', label: 'gpt-5' },
  { value: 'o3', label: 'o3' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
  { value: 'gpt-4o', label: 'gpt-4o' },
];

export default function IndexForm() {
  const { user } = useUser();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tokenA: 'usdt',
      tokenB: 'sol',
      tokenAPercent: 50,
      tokenBPercent: 50,
      risk: 'low',
      rebalance: '1h',
      model: 'gpt-5',
      systemPrompt:
        'Manage this index using the defined parameters. Use news and real market data to catch lows and highs.',
    },
  });

  const tokenA = watch('tokenA');
  const tokenB = watch('tokenB');

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    await api.post('/indexes', { userId: user.id, ...values });
  });

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white shadow-md rounded p-6 space-y-4 w-full max-w-xl"
    >
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
            {tokens
              .filter((t) => t.value === tokenA || t.value !== tokenB)
              .map((t) => (
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
            {...register('tokenAPercent', {
              valueAsNumber: true,
              onChange: (e) => {
                let val = Number(e.target.value);
                if (isNaN(val)) val = 1;
                val = Math.max(1, Math.min(99, val));
                setValue('tokenAPercent', val, { shouldValidate: true });
                setValue('tokenBPercent', 100 - val, { shouldValidate: true });
              },
            })}
            min={1}
            max={99}
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
            {tokens
              .filter((t) => t.value === tokenB || t.value !== tokenA)
              .map((t) => (
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
            {...register('tokenBPercent', {
              valueAsNumber: true,
              onChange: (e) => {
                let val = Number(e.target.value);
                if (isNaN(val)) val = 1;
                val = Math.max(1, Math.min(99, val));
                setValue('tokenBPercent', val, { shouldValidate: true });
                setValue('tokenAPercent', 100 - val, { shouldValidate: true });
              },
            })}
            min={1}
            max={99}
            className="w-full border rounded p-2"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="risk">
          Risk Tolerance
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
          <option value="1h">1 hour</option>
          <option value="3h">3 hours</option>
          <option value="5h">5 hours</option>
          <option value="12h">12 hours</option>
          <option value="24h">1 day</option>
          <option value="3d">3 days</option>
          <option value="1w">1 week</option>
        </select>
      </div>
      <div>
        {!user?.openaiKey && (
          <p className="text-sm text-gray-600 mb-1">add your openai key to continue</p>
        )}
        <label className="block text-sm font-medium mb-1" htmlFor="model">
          Model
        </label>
        <select
          id="model"
          {...register('model')}
          className="w-full border rounded p-2"
          disabled={!user?.openaiKey}
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          className="block text-sm font-medium mb-1"
          htmlFor="systemPrompt"
        >
          System Prompt
        </label>
        <textarea
          id="systemPrompt"
          {...register('systemPrompt')}
          className="w-full border rounded p-2 h-32"
        />
      </div>
      {!user && (
        <p className="text-sm text-gray-600 mb-2">Please log in to continue</p>
      )}
      <button
        type="submit"
        className={`w-full py-2 rounded ${
          user
            ? 'bg-blue-600 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        disabled={!user}
      >
        Save
      </button>
    </form>
  );
}
