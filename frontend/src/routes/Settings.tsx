import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/user';

type KeyType = 'ai' | 'binance';

function KeySection({ type, label }: { type: KeyType; label: string }) {
  const { user } = useUser();
  const form = useForm<{ key: string }>({ defaultValues: { key: '' } });
  const id = user!.id;
  const query = useQuery<string | null>({
    queryKey: [type, id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${id}/${type}-key`);
        return res.data.key as string;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  useEffect(() => {
    form.setValue('key', query.data ?? '');
  }, [query.data, form]);

  const saveMut = useMutation({
    mutationFn: async (key: string) => {
      const method = query.data ? 'put' : 'post';
      const res = await api[method](`/users/${id}/${type}-key`, { key });
      return res.data.key as string;
    },
    onSuccess: () => query.refetch(),
  });

  const delMut = useMutation({
    mutationFn: async () => {
      await api.delete(`/users/${id}/${type}-key`);
    },
    onSuccess: () => query.refetch(),
  });

  const onSubmit = form.handleSubmit((data) => saveMut.mutate(data.key));

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">{label}</h2>
      {query.isLoading ? (
        <p>Loading...</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-2">
          <input
            type="text"
            {...form.register('key')}
            className="border rounded p-2 w-full"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              {query.data ? 'Update' : 'Save'}
            </button>
            {query.data && (
              <button
                type="button"
                onClick={() => delMut.mutate()}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useUser();
  if (!user) return <p>Please log in.</p>;
  return (
    <div className="space-y-8 max-w-md">
      <KeySection type="ai" label="OpenAI API Key" />
      <KeySection type="binance" label="Binance API Key" />
    </div>
  );
}
