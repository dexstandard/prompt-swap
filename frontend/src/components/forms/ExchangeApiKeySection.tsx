import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';

interface Props {
  exchange: string;
  label: string;
}

export default function ExchangeApiKeySection({ exchange, label }: Props) {
  const { user } = useUser();
  const form = useForm<{ key: string; secret: string }>({
    defaultValues: { key: '', secret: '' },
    mode: 'onChange',
  });
  const id = user!.id;
  const keyPath = `/users/${id}/${exchange}-key`;
  const balancePath = `/users/${id}/${exchange}-balance`;
  const query = useQuery<{ key: string; secret: string } | null>({
    queryKey: [`${exchange}-key`, id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(keyPath);
        return res.data as { key: string; secret: string };
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  useEffect(() => {
    form.reset(query.data ?? { key: '', secret: '' });
  }, [query.data, form]);

  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(!query.data);
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: async (vals: { key: string; secret: string }) => {
      const method = query.data ? 'put' : 'post';
      const res = await api[method](keyPath, vals);
      return res.data as { key: string; secret: string };
    },
    onSuccess: () => {
      query.refetch();
      setEditing(false);
    },
    onError: (err) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.data?.error === 'verification failed'
      ) {
        alert('Key verification failed');
      }
    },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      await api.delete(keyPath);
    },
    onSuccess: () => query.refetch(),
  });

  const balanceQuery = useQuery<{ totalUsd: number }>({
    queryKey: [`${exchange}-balance`, id],
    enabled: !!query.data && !editing,
    queryFn: async () => {
      const res = await api.get(balancePath, {
        headers: { 'x-user-id': id },
      });
      return res.data as { totalUsd: number };
    },
  });

  const onSubmit = form.handleSubmit((data) => saveMut.mutate(data));
  const buttonsDisabled = !form.formState.isValid;

  return (
    <div className="space-y-2">
      {label && <h2 className="text-lg font-bold">{label}</h2>}
      {query.isLoading ? (
        <p>Loading...</p>
      ) : editing ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="API Key"
            {...form.register('key', { required: true, minLength: 10 })}
            className="border rounded p-2 w-full"
          />
          <input
            type="text"
            placeholder="API Secret"
            {...form.register('secret', { required: true, minLength: 10 })}
            className="border rounded p-2 w-full"
          />
          {(form.formState.errors.key || form.formState.errors.secret) && (
            <p className="text-sm text-red-600">
              Key and secret are required and must be at least 10 characters
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={buttonsDisabled}
              className={`bg-blue-600 text-white px-4 py-2 rounded ${
                buttonsDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {query.data ? 'Update' : 'Save'}
            </button>
            {query.data && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  form.reset(query.data ?? { key: '', secret: '' });
                }}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query.data?.key ?? ''}
              disabled
              className="border rounded p-2 w-full"
            />
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                form.reset({ key: '', secret: '' });
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => delMut.mutate()}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Delete
            </button>
          </div>
          {balanceQuery.isLoading ? (
            <p>Loading balance...</p>
          ) : balanceQuery.data ? (
            <p className="text-sm text-gray-600">
              Total balance: ${balanceQuery.data.totalUsd.toFixed(2)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

