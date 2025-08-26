import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import { useToast } from '../lib/useToast';
import Button from './ui/Button';
import PromptDialog from './ui/PromptDialog';

type CredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (resp: CredentialResponse) => void;
          }) => void;
          renderButton: (
            elem: HTMLElement,
            options: { theme: string; size: string; text: string }
          ) => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

export default function GoogleLoginButton() {
  const btnRef = useRef<HTMLDivElement>(null);
  const { user, setUser } = useUser();
  const toast = useToast();
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingCred, setPendingCred] = useState<string | null>(null);

  const handleOtpSubmit = async (otp: string) => {
    if (!pendingCred) return;
    try {
      const res2 = await api.post('/login', { token: pendingCred, otp });
      setUser(res2.data);
      if (btnRef.current) btnRef.current.innerHTML = '';
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Login failed');
      }
    } finally {
      setOtpOpen(false);
      setPendingCred(null);
    }
  };

  useEffect(() => {
    const google = window.google;
    if (!google || !btnRef.current || user) return;

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (resp: CredentialResponse) => {
        try {
          const res = await api.post('/login', { token: resp.credential });
          setUser(res.data);
          if (btnRef.current) btnRef.current.innerHTML = '';
        } catch (err: unknown) {
          if (
            axios.isAxiosError(err) &&
            err.response?.data?.error === 'otp required'
          ) {
            setPendingCred(resp.credential);
            setOtpOpen(true);
          }
        }
      },
    });
    google.accounts.id.renderButton(btnRef.current, {
      theme: 'outline',
      size: 'small',
      text: 'signin',
    });
  }, [user, setUser]);

  const handleOtpCancel = () => {
    setOtpOpen(false);
    setPendingCred(null);
  };

  const email = user?.email ?? '';
  return (
    <>
      {user ? (
        <div className="h-5 flex items-center text-sm gap-2">
          <span className="hidden md:inline">{email}</span>
          <span className="md:hidden">{email.split('@')[0]}</span>
          <Button
            type="button"
            variant="link"
            className="text-xs flex items-center gap-1"
            onClick={() => {
              const google = window.google;
              google?.accounts.id.disableAutoSelect?.();
              setUser(null);
            }}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div ref={btnRef} className="h-5 capitalize" />
      )}
      <PromptDialog
        open={otpOpen}
        message="Enter 2FA code"
        onSubmit={handleOtpSubmit}
        onCancel={handleOtpCancel}
      />
    </>
  );
}
