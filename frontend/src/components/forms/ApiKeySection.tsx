import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';
import Button from '../ui/Button';

interface Field {
  name: string;
  placeholder: string;
  minLength?: number;
}

interface ApiKeySectionProps {
  label?: string;
  queryKey: string;
  getKeyPath: (id: string) => string;
  fields: Field[];
  videoGuideUrl?: string;
  balanceQueryKey?: string;
  getBalancePath?: (id: string) => string;
}

const textSecurityStyle: CSSProperties & { WebkitTextSecurity: string } = {
  WebkitTextSecurity: 'disc',
};

export default function ApiKeySection({
  label,
  queryKey,
  getKeyPath,
  fields,
  videoGuideUrl,
  balanceQueryKey,
  getBalancePath,
}: ApiKeySectionProps) {
  const { user } = useUser();
  const defaultValues = useMemo(
    () =>
      Object.fromEntries(fields.map((f) => [f.name, ''])) as Record<string, string>,
    [fields],
  );
  const form = useForm<Record<string, string>>({
    defaultValues,
    mode: 'onChange',
  });
  const id = user!.id;
  const query = useQuery<Record<string, string> | null>({
    queryKey: [queryKey, id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(getKeyPath(id));
        return res.data as Record<string, string>;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  useEffect(() => {
    form.reset(query.data ?? defaultValues);
  }, [query.data, defaultValues, form]);

  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(!query.data);
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: async (vals: Record<string, string>) => {
      const method = query.data ? 'put' : 'post';
      const res = await api[method](getKeyPath(id), vals);
      return res.data as Record<string, string>;
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
      await api.delete(getKeyPath(id));
    },
    onSuccess: () => query.refetch(),
  });

  const balanceQuery = useQuery<{ totalUsd: number }>({
    queryKey: [balanceQueryKey!, id],
    enabled: !!query.data && !editing && !!balanceQueryKey && !!getBalancePath,
    queryFn: async () => {
      const res = await api.get(getBalancePath!(id));
      return res.data as { totalUsd: number };
    },
  });

  const onSubmit = form.handleSubmit((data) => saveMut.mutate(data));
  const saveDisabled = !form.formState.isValid || saveMut.isPending;
  const hasErrors = Object.keys(form.formState.errors).length > 0;

  return (
    <div className="space-y-2 w-full max-w-md">
      {label && <h2 className="text-md font-bold">{label}</h2>}
      {query.isLoading ? (
        <p>Loading...</p>
      ) : editing ? (
        <div className="space-y-2">
          {fields.map((f) => (
            <input
              key={f.name}
              type="text"
              autoComplete="off"
              placeholder={f.placeholder}
              {...form.register(f.name, { required: true, minLength: f.minLength ?? 10 })}
              className="border rounded px-2 py-1 w-full"
              style={form.watch(f.name) ? textSecurityStyle : undefined}
              data-lpignore="true"
              data-1p-ignore="true"
            />
          ))}
          {videoGuideUrl && (
            <p className="text-sm text-gray-600 space-x-2">
              <a
                href={videoGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Video guide
              </a>
            </p>
          )}
          {hasErrors && (
            <p className="text-sm text-red-600">
              All fields are required and must be at least 10 characters
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={saveDisabled}
              loading={saveMut.isPending}
            >
              {query.data ? 'Update' : 'Save'}
            </Button>
            {query.data && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  form.reset(query.data ?? defaultValues);
                }}
                disabled={saveMut.isPending}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query.data ? query.data[fields[0].name] ?? '' : ''}
              disabled
              className="border rounded px-2 py-1 w-full"
              style={textSecurityStyle}
              data-lpignore="true"
              data-1p-ignore="true"
            />
            <Button
              type="button"
              onClick={() => {
                setEditing(true);
                form.reset(defaultValues);
              }}
              disabled={delMut.isPending}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => delMut.mutate()}
              disabled={delMut.isPending}
            >
              Delete
            </Button>
          </div>
          {balanceQueryKey && (
            balanceQuery.isLoading ? (
              <p>Loading balance...</p>
            ) : balanceQuery.data ? (
              <p className="text-sm text-gray-600">
                Total balance: ${balanceQuery.data.totalUsd.toFixed(2)}
              </p>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

