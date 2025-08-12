import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '../../lib/axios';

function ApiStatus() {
  const { isSuccess } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => axios.get('/indexes'),
  });

  return <span className="text-sm">API: {isSuccess ? 'Online' : 'Offline'}</span>;
}

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between">
        <span className="font-bold">PromptSwap</span>
        <ApiStatus />
      </header>
      <div className="flex flex-1">
        <nav className="w-48 bg-gray-100 p-4">
          <Link to="/" className="block mb-2 text-gray-700 hover:text-gray-900">
            Index
          </Link>
          <Link to="/settings" className="block mb-2 text-gray-700 hover:text-gray-900">
            Settings
          </Link>
        </nav>
        <main className="flex-1 p-4 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
