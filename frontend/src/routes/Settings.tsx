import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import Button from '../components/ui/Button';
import { useToast } from '../lib/useToast';
import { useTranslation, useLanguage, type Lang } from '../lib/i18n';

export default function Settings() {
  const { user } = useUser();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingEnable, setLoadingEnable] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);
  const t = useTranslation();
  const { lang, setLang } = useLanguage();

  useEffect(() => {
    if (!user) return;
    api.get('/2fa/status').then((res) => setEnabled(res.data.enabled));
  }, [user]);

  if (!user) return <p>{t('login_prompt')}</p>;
  if (enabled === null) return <p>{t('loading')}</p>;

  const startSetup = async () => {
    setLoadingSetup(true);
    try {
      const res = await api.get('/2fa/setup');
      setSetup(res.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          toast.show(err.response.data.error);
        } else if (err.response?.status === 429) {
          toast.show('Too many requests. Please try again later.');
        } else {
          toast.show('Failed to start 2FA setup');
        }
      } else {
        toast.show('Failed to start 2FA setup');
      }
    } finally {
      setLoadingSetup(false);
    }
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    setLoadingEnable(true);
    try {
      await api.post('/2fa/enable', { token: code, secret: setup.secret });
      setEnabled(true);
      setSetup(null);
      setCode('');
      toast.show('2FA enabled', 'success');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          toast.show(err.response.data.error);
        } else if (err.response?.status === 429) {
          toast.show('Too many requests. Please try again later.');
        } else {
          toast.show('Failed to enable 2FA');
        }
      } else {
        toast.show('Failed to enable 2FA');
      }
    } finally {
      setLoadingEnable(false);
    }
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    setLoadingDisable(true);
    try {
      await api.post('/2fa/disable', { token: code });
      setEnabled(false);
      setCode('');
      toast.show('2FA disabled', 'success');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          toast.show(err.response.data.error);
        } else if (err.response?.status === 429) {
          toast.show('Too many requests. Please try again later.');
        } else {
          toast.show('Failed to disable 2FA');
        }
      } else {
        toast.show('Failed to disable 2FA');
      }
    } finally {
      setLoadingDisable(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-xl font-bold">{t('settings')}</h2>
      {enabled ? (
        <form onSubmit={disable} className="space-y-2">
          <p>{t('2fa_enabled')}</p>
          <input
            className="border p-1 w-40"
            placeholder={t('code')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" loading={loadingDisable}>
            {t('disable')}
          </Button>
        </form>
      ) : setup ? (
        <form onSubmit={enable} className="space-y-2">
          <p>{t('scan_qr')}</p>
          <QRCode value={setup.otpauthUrl} />
          <input
            className="border p-1 w-40"
            placeholder={t('code')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" loading={loadingEnable}>
            {t('enable')}
          </Button>
        </form>
      ) : (
        <Button onClick={startSetup} loading={loadingSetup}>
          {t('setup_2fa')}
        </Button>
      )}
      <div className="pt-4">
        <label className="block text-sm font-medium mb-1">
          {t('language')}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="ml-2 border p-1"
          >
            <option value="en">{t('english')}</option>
            <option value="ru">{t('russian')}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
