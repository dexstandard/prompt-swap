import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  token: z.string().min(1, 'Token is required'),
  risk: z.enum(['low', 'medium', 'high']),
});

type FormValues = z.infer<typeof schema>;

const tokens = [
  { value: 'btc', label: 'BTC' },
  { value: 'eth', label: 'ETH' },
  { value: 'sol', label: 'SOL' },
];

export default function IndexForm() {
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: '', risk: 'low' },
  });

  const onSubmit = handleSubmit((values) => {
    console.log(values);
  });

  return (
    <form onSubmit={onSubmit} className="bg-white shadow-md rounded p-6 space-y-4">
      <h2 className="text-xl font-bold">Create Index</h2>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="token">
          Token
        </label>
        <select id="token" {...register('token')} className="w-full border rounded p-2">
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
        <label className="block text-sm font-medium mb-1" htmlFor="risk">
          Risk
        </label>
        <select id="risk" {...register('risk')} className="w-full border rounded p-2">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
        Save
      </button>
    </form>
  );
}
