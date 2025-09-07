import { useUser } from '../lib/useUser';
import AiApiKeySection from '../components/forms/AiApiKeySection';
import ExchangeApiKeySection from '../components/forms/ExchangeApiKeySection';

export default function Keys() {
  const { user } = useUser();
  if (!user) return <p>Please log in.</p>;
  return (
    <div className="space-y-8 max-w-md">
      <div className="p-3 bg-blue-100 border border-blue-200 text-sm text-blue-900 rounded">
        Your API keys are encrypted using AES-256 and stored only on our server. They are
        decrypted solely when needed to call providers and are never shared.
      </div>
      <AiApiKeySection label="OpenAI API Key" />
      <ExchangeApiKeySection
        exchange="binance"
        label={
          <>
            Binance API <span className="hidden sm:inline">Credentials</span>
          </>
        }
      />
    </div>
  );
}
