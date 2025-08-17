import { useEffect, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';
import Button from '../ui/Button';

const textSecurityStyle: CSSProperties & { WebkitTextSecurity: string } = {
  WebkitTextSecurity: 'disc',
};

export default function AiApiKeySection({ label }: { label: string }) {
  const { user } = useUser();
  const form = useForm<{ key: string }>({
    defaultValues: { key: '' },
    mode: 'onChange',
  });
  const keyValue = form.watch('key');
  const id = user!.id;
  const query = useQuery<string | null>({
    queryKey: ['ai-key', id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${id}/ai-key`);
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

  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(!query.data);
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: async (key: string) => {
      const method = query.data ? 'put' : 'post';
      const res = await api[method](`/users/${id}/ai-key`, { key });
      return res.data.key as string;
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
      await api.delete(`/users/${id}/ai-key`);
    },
    onSuccess: () => query.refetch(),
  });

  const onSubmit = form.handleSubmit((data) => saveMut.mutate(data.key));
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
          <p className="text-sm text-gray-600 space-x-2">
            <a
              href="https://www.youtube.com/watch?v=WjVf80HUvYg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Video guide
            </a>
          </p>
          {form.formState.errors.key && (
            <p className="text-sm text-red-600">
              {form.formState.errors.key.type === 'required'
                ? 'Key is required'
                : 'Key too short'}
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
                  form.setValue('key', query.data ?? '');
                }}
                disabled={saveMut.isPending}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={query.data ?? ''}
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
              form.setValue('key', '');
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
      )}
    </div>
  );
}
