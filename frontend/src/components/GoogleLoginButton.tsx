import { useEffect, useRef } from 'react';
import api from '../lib/axios';

export default function GoogleLoginButton() {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const google = (window as any).google;
    if (!google || !btnRef.current) return;

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        await api.post('/login', { token: resp.credential });
      },
    });
    google.accounts.id.renderButton(btnRef.current, {
      theme: 'outline',
      size: 'large',
    });
  }, []);

  return <div ref={btnRef}></div>;
}
