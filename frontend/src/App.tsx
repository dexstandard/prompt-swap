import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './routes/Dashboard';
import AgentTemplates from './routes/AgentTemplates';
import Settings from './routes/Settings';
import ViewAgentTemplate from './routes/ViewAgentTemplate';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agent-templates" element={<AgentTemplates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/agent-templates/:id" element={<ViewAgentTemplate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
