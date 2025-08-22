import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './routes/Dashboard';
import Keys from './routes/Keys';
import AgentPreview from './routes/AgentPreview';
import AgentView from './routes/AgentView';
import Settings from './routes/Settings';
import Terms from './routes/Terms';
import Privacy from './routes/Privacy';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/keys" element={<Keys />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/agent-preview" element={<AgentPreview />} />
        <Route path="/agents/:id" element={<AgentView />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
