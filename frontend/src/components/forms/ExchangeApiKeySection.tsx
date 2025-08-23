import ApiKeySection from './ApiKeySection';

const videoGuideLinks: Record<string, string> = {
  binance: 'https://youtu.be/2NLF6eV2xhk?t=20',
};

interface Props {
  exchange: string;
  label: string;
}

export default function ExchangeApiKeySection({ exchange, label }: Props) {
  return (
    <ApiKeySection
      label={label}
      queryKey={`${exchange}-key`}
      getKeyPath={(id) => `/users/${id}/${exchange}-key`}
      fields={[
        { name: 'key', placeholder: 'API key' },
        { name: 'secret', placeholder: 'API secret' },
      ]}
      videoGuideUrl={videoGuideLinks[exchange]}
      balanceQueryKey={`${exchange}-balance`}
      getBalancePath={(id) => `/users/${id}/${exchange}-balance`}
    />
  );
}

