import { useEffect, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';

const textSecurityStyle: CSSProperties & { WebkitTextSecurity: string } = {
  WebkitTextSecurity: 'disc',
};

const videoGuideLinks: Record<string, string> = {
  binance: 'https://youtu.be/2NLF6eV2xhk?t=20',
};

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
  const keyValue = form.watch('key');
  const secretValue = form.watch('secret');
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
  const saveDisabled = !form.formState.isValid || saveMut.isPending;

  return (
    <div className="space-y-2 w-full max-w-md">
      {label && <h2 className="text-md font-bold">{label}</h2>}
      {query.isLoading ? (
        <p>Loading...</p>
      ) : editing ? (
        <div className="space-y-2">
          <input
            type="text"
            autoComplete="off"
            placeholder="API key"
            {...form.register('key', { required: true, minLength: 10 })}
            className="border rounded px-2 py-1 w-full"
            style={keyValue ? textSecurityStyle : undefined}
            data-lpignore="true"
            data-1p-ignore="true"
          />
          <input
            type="text"
            autoComplete="off"
            placeholder="API secret"
            {...form.register('secret', { required: true, minLength: 10 })}
            className="border rounded px-2 py-1 w-full"
            style={secretValue ? textSecurityStyle : undefined}
            data-lpignore="true"
            data-1p-ignore="true"
          />
          {videoGuideLinks[exchange] && (
            <p className="text-sm text-gray-600 space-x-2">
              <a
                href={videoGuideLinks[exchange]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Video guide
              </a>
            </p>
          )}
          {(form.formState.errors.key || form.formState.errors.secret) && (
            <p className="text-sm text-red-600">
              Key and secret are required and must be at least 10 characters
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={saveDisabled}
              className={`bg-blue-600 text-white px-2 py-1 rounded ${
                saveDisabled ? 'opacity-50 cursor-not-allowed' : ''
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
                disabled={saveMut.isPending}
                className={`bg-gray-300 px-2 py-1 rounded ${
                  saveMut.isPending ? 'opacity-50 cursor-not-allowed' : ''
                }`}
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
              className="border rounded px-2 py-1 w-full"
              style={textSecurityStyle}
              data-lpignore="true"
              data-1p-ignore="true"
            />
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                form.reset({ key: '', secret: '' });
              }}
              disabled={delMut.isPending}
              className={`bg-blue-600 text-white px-2 py-1 rounded ${
                delMut.isPending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => delMut.mutate()}
              disabled={delMut.isPending}
              className={`bg-red-600 text-white px-2 py-1 rounded ${
                delMut.isPending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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

