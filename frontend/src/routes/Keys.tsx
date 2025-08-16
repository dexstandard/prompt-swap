import { useUser } from '../lib/useUser';
import AiApiKeySection from '../components/forms/AiApiKeySection';
import ExchangeApiKeySection from '../components/forms/ExchangeApiKeySection';

export default function Keys() {
  const { user } = useUser();
  if (!user) return <p>Please log in.</p>;
  return (
    <div className="space-y-8 max-w-md">
      <AiApiKeySection label="OpenAI API Key" />
      <ExchangeApiKeySection exchange="binance" label="Binance API Credentials" />
    </div>
  );
}
