import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import api from '../lib/axios';
import { useUser } from '../lib/user';

export default function GoogleLoginButton() {
  const btnRef = useRef<HTMLDivElement>(null);
  const { user, setUser } = useUser();

  useEffect(() => {
    const google = (window as any).google;
    if (!google || !btnRef.current) return;

    // Clear any previously rendered buttons (StrictMode runs effects twice)
    btnRef.current.innerHTML = '';

    if (user) {
      // Remove the Google button once the user logs in so it doesn't overlay
      // the navigation links.
      return;
    }

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        const res = await api.post('/login', { token: resp.credential });
        setUser(res.data);
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
            const google = (window as any).google;
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
