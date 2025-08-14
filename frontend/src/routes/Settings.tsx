import { useUser } from '../lib/user';
import KeySection from '../components/forms/KeySection';

export default function Settings() {
  const { user } = useUser();
  if (!user) return <p>Please log in.</p>;
  return (
    <div className="space-y-8 max-w-md">
      <KeySection type="ai" label="OpenAI API Key" />
      <KeySection type="binance" label="Binance API Key" />
    </div>
  );
}
