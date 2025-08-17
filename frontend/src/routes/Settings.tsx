import { useEffect, useState, FormEvent } from 'react';
import QRCode from 'react-qr-code';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import Button from '../components/ui/Button';

export default function Settings() {
  const { user } = useUser();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!user) return;
    api
      .get('/2fa/status', { headers: { 'x-user-id': user.id } })
      .then((res) => setEnabled(res.data.enabled));
  }, [user]);

  if (!user) return <p>Please log in.</p>;
  if (enabled === null) return <p>Loading...</p>;

  const startSetup = async () => {
    const res = await api.get('/2fa/setup', { headers: { 'x-user-id': user.id } });
    setSetup(res.data);
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    await api.post(
      '/2fa/enable',
      { token: code, secret: setup.secret },
      { headers: { 'x-user-id': user.id } },
    );
    setEnabled(true);
    setSetup(null);
    setCode('');
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    await api.post(
      '/2fa/disable',
      { token: code },
      { headers: { 'x-user-id': user.id } },
    );
    setEnabled(false);
    setCode('');
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-xl font-bold">Settings</h2>
      {enabled ? (
        <form onSubmit={disable} className="space-y-2">
          <p>Two-factor authentication is enabled.</p>
          <input
            className="border p-1 w-40"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit">Disable</Button>
        </form>
      ) : setup ? (
        <form onSubmit={enable} className="space-y-2">
          <p>Scan this QR code with Google Authenticator and enter the code.</p>
          <QRCode value={setup.otpauthUrl} />
          <input
            className="border p-1 w-40"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit">Enable</Button>
        </form>
      ) : (
        <Button onClick={startSetup}>Setup 2FA</Button>
      )}
    </div>
  );
}
