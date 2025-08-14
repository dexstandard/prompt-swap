import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/user';

async function hmacSHA256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function BinanceKeySection({ label }: { label: string }) {
  const { user } = useUser();
  const form = useForm<{ key: string; secret: string }>({
    defaultValues: { key: '', secret: '' },
  });
  const id = user!.id;
  const query = useQuery<{ key: string; secret: string } | null>({
    queryKey: ['binance-key', id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${id}/binance-key`);
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

  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(!query.data);
    setIsValid(query.data ? true : null);
  }, [query.data]);

  const keyValue = form.watch('key');
  const secretValue = form.watch('secret');

  useEffect(() => {
    if (!editing) return;
    if (!keyValue || !secretValue) {
      setIsValid(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const timestamp = Date.now();
        const qs = `timestamp=${timestamp}`;
        const signature = await hmacSHA256(qs, secretValue);
        const res = await fetch(
          `https://api.binance.com/api/v3/account?${qs}&signature=${signature}`,
          { headers: { 'X-MBX-APIKEY': keyValue } }
        );
        setIsValid(res.ok);
      } catch {
        setIsValid(false);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [keyValue, secretValue, editing]);

  const saveMut = useMutation({
    mutationFn: async (vals: { key: string; secret: string }) => {
      const method = query.data ? 'put' : 'post';
      const res = await api[method](`/users/${id}/binance-key`, vals);
      return res.data as { key: string; secret: string };
    },
    onSuccess: () => {
      query.refetch();
      setEditing(false);
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error === 'invalid key') {
        alert('Invalid Binance API credentials');
        setIsValid(false);
      }
    },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      await api.delete(`/users/${id}/binance-key`);
    },
    onSuccess: () => query.refetch(),
  });

  const onSubmit = form.handleSubmit((data) => saveMut.mutate(data));
  const buttonsDisabled = isValid !== true;

  return (
    <div className="space-y-2">
      {label && <h2 className="text-lg font-bold">{label}</h2>}
      {query.isLoading ? (
        <p>Loading...</p>
      ) : editing ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <input
            type="text"
            placeholder="API Key"
            {...form.register('key')}
            className={`border rounded p-2 w-full ${
              isValid === false ? 'border-red-500' : ''
            }`}
          />
          <input
            type="text"
            placeholder="API Secret"
            {...form.register('secret')}
            className={`border rounded p-2 w-full ${
              isValid === false ? 'border-red-500' : ''
            }`}
          />
          {isValid === false && (
            <p className="text-sm text-red-600">Invalid Binance credentials</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
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
                  setIsValid(true);
                }}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
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
              setIsValid(null);
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
      )}
    </div>
  );
}
