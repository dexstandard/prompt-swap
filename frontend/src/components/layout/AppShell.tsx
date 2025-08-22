import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';
import GoogleLoginButton from '../GoogleLoginButton';
import { Bot, Key, Settings as SettingsIcon, Users as UsersIcon } from 'lucide-react';
import { useUser } from '../../lib/useUser';

function ApiStatus() {
  const { isSuccess } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => axios.get('/health'),
  });

  return <span className="text-sm">API: {isSuccess ? 'Online' : 'Offline'}</span>;
}

export default function AppShell() {
  const { user } = useUser();
  return (
    <div className="h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 bg-gray-800 text-white p-4 flex justify-between z-10">
        <span className="font-bold">PromptSwap</span>
        <div className="flex items-center gap-4">
          <ApiStatus />
          <GoogleLoginButton />
        </div>
      </header>
      <div className="flex flex-1 pt-16 pb-8 overflow-hidden">
        <nav className="w-48 bg-gray-100 p-4 overflow-y-auto">
          <Link to="/" className="flex items-center gap-2 mb-2 text-gray-700 hover:text-gray-900">
            <Bot className="w-4 h-4" />
            Agents
          </Link>
          <Link to="/keys" className="flex items-center gap-2 mb-2 text-gray-700 hover:text-gray-900">
            <Key className="w-4 h-4" />
            Keys
          </Link>
          <Link to="/settings" className="flex items-center gap-2 mb-2 text-gray-700 hover:text-gray-900">
            <SettingsIcon className="w-4 h-4" />
            Settings
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/users"
              className="flex items-center gap-2 mb-2 text-gray-700 hover:text-gray-900"
            >
              <UsersIcon className="w-4 h-4" />
              Users
            </Link>
          )}
        </nav>
        <main className="flex-1 p-3 pt-0 bg-white overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-100 text-xs text-center py-1 border-t">
        <Link to="/terms" className="mx-2 hover:text-gray-900">
          Terms
        </Link>
        <Link to="/privacy" className="mx-2 hover:text-gray-900">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
