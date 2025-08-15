import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from './axios';

export type User = {
  id: string;
  email?: string;
  openaiKey?: string;
  binanceKey?: string;
  binanceSecret?: string;
} | null;

const UserContext = createContext<{ user: User; setUser: (u: User) => void }>({
  user: null,
  setUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('user');
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });

  // Re-validate the stored user with Google on load to ensure the session
  // hasn't been invalidated. If the Google credential cannot be obtained the
  // user is cleared so stale localStorage does not keep them signed in.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const init = () => {
      const google = (window as any).google;
      if (!google) return;

      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (resp: any) => {
          try {
            const res = await api.post('/login', { token: resp.credential });
            setUser(res.data);
          } catch {
            setUser(null);
          }
        },
      });

      google.accounts.id.prompt((notification: any) => {
        if (
          notification.isNotDisplayed() ||
          notification.isSkippedMoment()
        ) {
          setUser(null);
        }
      });
    };

    if ((window as any).google) {
      init();
    } else {
      const id = setInterval(() => {
        if ((window as any).google) {
          clearInterval(id);
          init();
        }
      }, 100);
      return () => clearInterval(id);
    }
  }, [setUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) {
      window.localStorage.setItem('user', JSON.stringify(user));
    } else {
      window.localStorage.removeItem('user');
    }
  }, [user]);

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
