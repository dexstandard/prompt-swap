import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './routes/Dashboard';
import CreateIndex from './routes/CreateIndex';
import Settings from './routes/Settings';
import ViewIndex from './routes/ViewIndex';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create-index" element={<CreateIndex />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/index-templates/:id" element={<ViewIndex />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
