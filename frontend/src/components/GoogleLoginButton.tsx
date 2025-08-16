import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';

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
        const res = await api.post('/login', { token: resp.credential });
        setUser(res.data);
        btnRef.current.innerHTML = '';
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
        <button
          onClick={() => {
            const google = window.google;
            google?.accounts.id.disableAutoSelect?.();
            setUser(null);
          }}
          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  return <div ref={btnRef} className="h-5 capitalize" />;
}
