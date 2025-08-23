import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';
import GoogleLoginButton from '../GoogleLoginButton';
import {
  Bot,
  Key,
  Settings as SettingsIcon,
  Users as UsersIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUser } from '../../lib/useUser';
import { useState } from 'react';

function ApiStatus() {
  const { isSuccess } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => axios.get('/health'),
  });

  return <span className="text-sm">API: {isSuccess ? 'Online' : 'Offline'}</span>;
}

export default function AppShell() {
  const { user } = useUser();
  const [navCollapsed, setNavCollapsed] = useState(false);
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
        <nav
          className={`${navCollapsed ? 'w-20' : 'w-32'} bg-gray-100 p-4 transition-all duration-300 flex flex-col`}
        >
          <div
            className={`flex flex-col flex-1 overflow-y-auto ${
              navCollapsed ? 'gap-3' : 'gap-2'
            }`}
          >
            <Link
              to="/"
              className={`flex items-center text-gray-700 hover:text-gray-900 ${
                navCollapsed ? 'justify-center' : 'gap-2'
              }`}
            >
              <Bot className={`${navCollapsed ? 'w-6 h-6' : 'w-4 h-4'}`} />
              {!navCollapsed && 'Agents'}
            </Link>
            <Link
              to="/keys"
              className={`flex items-center text-gray-700 hover:text-gray-900 ${
                navCollapsed ? 'justify-center' : 'gap-2'
              }`}
            >
              <Key className={`${navCollapsed ? 'w-6 h-6' : 'w-4 h-4'}`} />
              {!navCollapsed && 'Keys'}
            </Link>
            <Link
              to="/settings"
              className={`flex items-center text-gray-700 hover:text-gray-900 ${
                navCollapsed ? 'justify-center' : 'gap-2'
              }`}
            >
              <SettingsIcon className={`${navCollapsed ? 'w-6 h-6' : 'w-4 h-4'}`} />
              {!navCollapsed && 'Settings'}
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/users"
                className={`flex items-center text-gray-700 hover:text-gray-900 ${
                  navCollapsed ? 'justify-center' : 'gap-2'
                }`}
              >
                <UsersIcon className={`${navCollapsed ? 'w-6 h-6' : 'w-4 h-4'}`} />
                {!navCollapsed && 'Users'}
              </Link>
            )}
          </div>
          <button
            onClick={() => setNavCollapsed(!navCollapsed)}
            className={`mt-4 text-gray-700 hover:text-gray-900 ${
              navCollapsed ? 'flex justify-center w-full' : ''
            }`}
          >
            {navCollapsed ? (
              <ChevronRight className="w-6 h-6" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
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
