import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './routes/Dashboard';
import AgentTemplates from './routes/AgentTemplates';
import Keys from './routes/Keys';
import ViewAgentTemplate from './routes/ViewAgentTemplate';
import ViewAgent from './routes/ViewAgent';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agent-templates" element={<AgentTemplates />} />
        <Route path="/keys" element={<Keys />} />
        <Route path="/agent-templates/:id" element={<ViewAgentTemplate />} />
        <Route path="/agents/:id" element={<ViewAgent />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
