import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './routes/Dashboard';
import Keys from './routes/Keys';
import ViewAgentTemplate from './routes/ViewAgentTemplate';
import ViewAgent from './routes/ViewAgent';
import Settings from './routes/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/keys" element={<Keys />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/agent-templates/:id" element={<ViewAgentTemplate />} />
        <Route path="/agents/:id" element={<ViewAgent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
