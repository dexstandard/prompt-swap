import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import ApiKeySection from './ApiKeySection';

const videoGuideLinks: Record<string, string> = {
  binance: 'https://youtu.be/2NLF6eV2xhk?t=20',
};

const exchangeFields = [
  { name: 'key', placeholder: 'API key' },
  { name: 'secret', placeholder: 'API secret' },
];

interface Props {
  exchange: string;
  label: ReactNode;
}

export default function ExchangeApiKeySection({ exchange, label }: Props) {
  const commonProps = {
    label,
    queryKey: `${exchange}-key`,
    getKeyPath: (id: string) => `/users/${id}/${exchange}-key`,
    fields: exchangeFields,
    videoGuideUrl: videoGuideLinks[exchange],
    balanceQueryKey: `${exchange}-balance`,
    getBalancePath: (id: string) => `/users/${id}/${exchange}-balance`,
  } as const;

  const whitelistQuery = useQuery<string>({
    queryKey: ['output-ip'],
    enabled: exchange === 'binance',
    queryFn: async () => {
      const res = await api.get('/ip');
      return (res.data as { ip: string }).ip;
    },
  });

  return exchange === 'binance' ? (
    <ApiKeySection
      {...commonProps}
      whitelistHost={whitelistQuery.data}
    />
  ) : (
    <ApiKeySection {...commonProps} />
  );
}

