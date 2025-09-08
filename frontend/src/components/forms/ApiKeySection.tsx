import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';
import { useToast } from '../../lib/useToast';
import Button from '../ui/Button';
import { Copy } from 'lucide-react';

interface Field {
  name: string;
  placeholder: string;
  minLength?: number;
}

interface ApiKeySectionProps {
  label?: ReactNode;
  queryKey: string;
  getKeyPath: (id: string) => string;
  fields: Field[];
  videoGuideUrl?: string;
  balanceQueryKey?: string;
  getBalancePath?: (id: string) => string;
  whitelistHost?: string;
  sharePath?: (id: string) => string;
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
  whitelistHost,
  sharePath,
}: ApiKeySectionProps) {
  const { user } = useUser();
  const toast = useToast();
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
  const query = useQuery<{ [key: string]: string; shared?: boolean } | null>({
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
    const data = query.data
      ? fields.reduce(
          (acc, f) => ({ ...acc, [f.name]: query.data[f.name] ?? '' }),
          {} as Record<string, string>,
        )
      : defaultValues;
    form.reset(data);
  }, [query.data, defaultValues, form, fields]);

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
        toast.show('Key verification failed');
      }
    },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      await api.delete(getKeyPath(id));
    },
    onSuccess: () => query.refetch(),
  });

  const shareMut = useMutation({
    mutationFn: async (email: string) => {
      await api.post(sharePath!(id), { email });
    },
  });

  const revokeMut = useMutation({
    mutationFn: async (email: string) => {
      await api.delete(sharePath!(id), { data: { email } });
    },
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
            {!query.data?.shared && (
              <>
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
                  onClick={() => {
                    if (
                      window.confirm(
                        'Deleting this key will stop all active agents. Continue?',
                      )
                    ) {
                      delMut.mutate();
                    }
                  }}
                  disabled={delMut.isPending}
                >
                  Delete
                </Button>
              </>
            )}
            {query.data?.shared && (
              <p className="text-sm text-gray-600 self-center">Shared by admin</p>
            )}
            {user?.role === 'admin' && sharePath && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const email = window.prompt('Enter email to share with');
                    if (email) shareMut.mutate(email);
                  }}
                  disabled={
                    delMut.isPending || shareMut.isPending || revokeMut.isPending
                  }
                >
                  Share
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const email = window.prompt('Enter email to revoke');
                    if (email) revokeMut.mutate(email);
                  }}
                  disabled={
                    delMut.isPending || shareMut.isPending || revokeMut.isPending
                  }
                >
                  Revoke
                </Button>
              </>
            )}
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
      {whitelistHost && (
        <div className="text-sm text-gray-600 sm:flex sm:items-center sm:gap-2">
          <span className="block sm:inline">Whitelist IP:</span>
          <span className="flex items-center gap-2">
            <span className="font-mono">{whitelistHost}</span>
            <button
              type="button"
              className="p-1 border rounded"
              onClick={() => {
                navigator.clipboard.writeText(whitelistHost);
                toast.show('Copied to clipboard');
              }}
              aria-label="Copy IP"
            >
              <Copy className="w-4 h-4" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

