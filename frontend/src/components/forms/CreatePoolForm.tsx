import { Button, Select, TextInput, Textarea, Stack, Paper, Title } from '@mantine/core';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type NewPool, newPoolSchema } from '../../types';
import { usePools } from '../../hooks/usePools';
import { notifications } from '@mantine/notifications';

const exchangeOptions = [
  { value: 'binance', label: 'Binance' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'okx', label: 'OKX' },
];

export default function CreatePoolForm() {
  const { createMutation } = usePools();
  const form = useForm<NewPool>({
    resolver: zodResolver(newPoolSchema),
    defaultValues: {
      name: '',
      exchange: 'binance',
      symbols: [],
      riskPct: 1,
      maxPositions: 1,
      tpPct: 0,
      slPct: 0,
      notes: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        notifications.show({ message: 'Pool created', color: 'green' });
        form.reset();
      },
    });
  });

  return (
    <Paper withBorder shadow="sm" p="md" radius="md" component="form" onSubmit={onSubmit}>
      <Stack>
        <Title order={4}>Create Pool</Title>
        <TextInput label="Name" {...form.register('name')} />
        <Controller
          name="exchange"
          control={form.control}
          render={({ field }) => <Select label="Exchange" data={exchangeOptions} {...field} />}
        />
        <TextInput
          label="Symbols (comma separated)"
          {...form.register('symbols')}
          onBlur={(e) => form.setValue('symbols', e.target.value.split(',').map((s) => s.trim()))}
        />
        <TextInput label="Risk %" type="number" {...form.register('riskPct', { valueAsNumber: true })} />
        <TextInput label="Max Positions" type="number" {...form.register('maxPositions', { valueAsNumber: true })} />
        <TextInput label="TP %" type="number" {...form.register('tpPct', { valueAsNumber: true })} />
        <TextInput label="SL %" type="number" {...form.register('slPct', { valueAsNumber: true })} />
        <Textarea label="Notes" {...form.register('notes')} />
        <Button type="submit" loading={createMutation.isPending} mt="md" fullWidth>
          Create
        </Button>
      </Stack>
    </Paper>
  );
}
