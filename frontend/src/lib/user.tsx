import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

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
  const [user, setUser] = useState<User>(null);
  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
