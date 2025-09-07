import { useMemo, type ReactElement } from 'react';

import { useQueries } from '@tanstack/react-query';
import axios from 'axios';
import { useUser } from '../../lib/useUser';
import api from '../../lib/axios';
import SelectInput from './SelectInput';
import AiApiKeySection from './AiApiKeySection';
import ExchangeApiKeySection from './ExchangeApiKeySection';

interface ProviderConfig {
  value: string;
  label: string;
  queryKey: string;
  getKeyPath: (id: string) => string;
  renderForm: () => ReactElement;
}

const aiConfigs: ProviderConfig[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    queryKey: 'ai-key',
    getKeyPath: (id) => `/users/${id}/ai-key`,
    renderForm: () => <AiApiKeySection label="OpenAI API Key" />,
  },
];

const exchangeConfigs: ProviderConfig[] = [
  {
    value: 'binance',
    label: 'Binance',
    queryKey: 'binance-key',
    getKeyPath: (id) => `/users/${id}/binance-key`,
    renderForm: () => (
      <ExchangeApiKeySection exchange="binance" label="Binance API Credentials" />
    ),
  },
];

interface Props {
  type: 'ai' | 'exchange';
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export default function ApiKeyProviderSelector({
  type,
  label,
  value,
  onChange,
}: Props) {
  const { user } = useUser();
  const configs = type === 'ai' ? aiConfigs : exchangeConfigs;

  const queries = useQueries({
    queries: configs.map((cfg) => ({
      queryKey: [cfg.queryKey, user?.id],
      enabled: !!user,
      queryFn: async () => {
        try {
          await api.get(cfg.getKeyPath(user!.id));
          return true;
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 404) return false;
          throw err;
        }
      },
    })),
  });

  const available = useMemo(
    () => configs.filter((_, i) => queries[i]?.data),
    [configs, queries],
  );

  if (!user) return null;

  if (available.length === 0) {
    return configs[0].renderForm();
  }

  return (
    <div>
      <h2 className="text-md font-bold">{label}</h2>
      <SelectInput
        id={`${type}-provider`}
        value={value}
        onChange={onChange}
        options={available.map((p) => ({ value: p.value, label: p.label }))}
      />
    </div>
  );
}
