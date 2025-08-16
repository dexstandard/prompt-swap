import { useUser } from '../lib/useUser';
import AiApiKeySection from '../components/forms/AiApiKeySection';
import BinanceKeySection from '../components/forms/BinanceKeySection';

export default function Settings() {
  const { user } = useUser();
  if (!user) return <p>Please log in.</p>;
  return (
    <div className="space-y-8 max-w-md">
      <AiApiKeySection label="OpenAI API Key" />
      <BinanceKeySection label="Binance API Credentials" />
    </div>
  );
}
