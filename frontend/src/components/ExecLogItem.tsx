import { useState } from 'react';
import { AlertCircle, Eye } from 'lucide-react';
import Modal from './ui/Modal';

export interface ExecLog {
  id: string;
  log: string;
  error?: Record<string, unknown>;
  createdAt: number;
}

interface Props {
  log: ExecLog;
}

export default function ExecLogItem({ log }: Props) {
  const [showJson, setShowJson] = useState(false);
  const hasError = log.error && Object.keys(log.error).length > 0;
  return (
    <div>
      <div className="whitespace-pre-wrap">{log.log}</div>
      {hasError && (
        <div className="mt-1 rounded border border-red-300 bg-red-50 p-2 text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4" />
          <div className="flex-1">
            <span className="font-bold mr-1">ERROR</span>
            <span>{(log.error as any).message || JSON.stringify(log.error)}</span>
          </div>
          <Eye
            className="h-4 w-4 cursor-pointer"
            onClick={() => setShowJson(true)}
          />
          <Modal open={showJson} onClose={() => setShowJson(false)}>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(log.error, null, 2)}
            </pre>
          </Modal>
        </div>
      )}
    </div>
  );
}
