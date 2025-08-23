import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import Button from './ui/Button';

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
            const otp = window.prompt('Enter 2FA code');
            if (otp) {
              const res2 = await api.post('/login', {
                token: resp.credential,
                otp,
              });
              setUser(res2.data);
              if (btnRef.current) btnRef.current.innerHTML = '';
            }
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

  if (user)
    return (
      <div className="h-5 flex items-center text-sm gap-2">
        <span>{user.email}</span>
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
    );
  return <div ref={btnRef} className="h-5 capitalize" />;
}
