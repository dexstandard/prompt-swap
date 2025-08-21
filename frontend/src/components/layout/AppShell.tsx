import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';
import GoogleLoginButton from '../GoogleLoginButton';
import { Bot, Key, Settings as SettingsIcon } from 'lucide-react';

function ApiStatus() {
  const { isSuccess } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => axios.get('/health'),
  });

  return <span className="text-sm">API: {isSuccess ? 'Online' : 'Offline'}</span>;
}

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between">
        <span className="font-bold">PromptSwap</span>
        <div className="flex items-center gap-4">
          <ApiStatus />
          <GoogleLoginButton />
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-48 bg-gray-100 p-4 flex flex-col justify-between h-full">
          <div>
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
          </div>
          <div className="text-sm text-gray-600">
            <Link to="/terms" className="block mb-2 hover:text-gray-900">
              Terms
            </Link>
            <Link to="/privacy" className="block hover:text-gray-900">
              Privacy
            </Link>
          </div>
        </nav>
        <main className="flex-1 p-3 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
