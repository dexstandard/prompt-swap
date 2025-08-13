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
      size: 'small',
      text: 'signin',
    });
  }, [user, setUser]);

  if (user)
    return (
      <div className="h-5 flex items-center text-sm">{user.email}</div>
    );
  return <div ref={btnRef} className="h-5 capitalize" />;
}
