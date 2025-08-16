import { useUser } from '../lib/useUser';
import KeySection from '../components/forms/KeySection';
import BinanceKeySection from '../components/forms/BinanceKeySection';

export default function Settings() {
  const { user } = useUser();
  if (!user) return <p>Please log in.</p>;
  return (
    <div className="space-y-8 max-w-md">
      <KeySection label="OpenAI API Key" />
      <BinanceKeySection label="Binance API Credentials" />
    </div>
  );
}
