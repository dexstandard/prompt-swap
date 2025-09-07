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
  label: string;
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

  return exchange === 'binance' ? (
    <ApiKeySection
      {...commonProps}
      whitelistHost={import.meta.env.VITE_DO_SSH_HOST}
    />
  ) : (
    <ApiKeySection {...commonProps} />
  );
}

