import { useEffect, useRef } from 'react';
import api from '../lib/axios';
import { useUser } from '../lib/user';

export default function GoogleLoginButton() {
  const btnRef = useRef<HTMLDivElement>(null);
  const { user, setUser } = useUser();

  useEffect(() => {
    const google = (window as any).google;
    if (!google || !btnRef.current || user) return;

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        const res = await api.post('/login', { token: resp.credential });
        setUser(res.data);
      },
    });
    google.accounts.id.renderButton(btnRef.current, {
      theme: 'outline',
      size: 'large',
    });
  }, [user, setUser]);

  if (user) return <span className="text-sm">{user.email}</span>;
  return <div ref={btnRef}></div>;
}
