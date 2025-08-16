import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';

export default function KeySection({ label }: { label: string }) {
  const { user } = useUser();
  const form = useForm<{ key: string }>({
    defaultValues: { key: '' },
    mode: 'onChange',
  });
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
            {...form.register('key', { required: true, minLength: 10 })}
            className="border rounded p-2 w-full"
          />
          {form.formState.errors.key && (
            <p className="text-sm text-red-600">
              {form.formState.errors.key.type === 'required'
                ? 'Key is required'
                : 'Key too short'}
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
                  form.setValue('key', query.data ?? '');
                }}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={query.data ?? ''}
            disabled
            className="border rounded p-2 w-full"
          />
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              form.setValue('key', '');
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
