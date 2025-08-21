import { useState } from 'react';
import { AlertCircle, Eye } from 'lucide-react';
import Modal from './ui/Modal';
import ExecSuccessItem from './ExecSuccessItem';

export interface ExecLog {
  id: string;
  log: string;
  response?: {
    rebalance: boolean;
    newAllocation?: number;
    shortReport: string;
  };
  error?: Record<string, unknown>;
  createdAt: number;
}

interface Props {
  log: ExecLog;
}

export default function ExecLogItem({ log }: Props) {
  const [showJson, setShowJson] = useState(false);
  const { log: text, error, response } = log;
  const hasError = error && Object.keys(error).length > 0;
  const hasResponse = response && Object.keys(response).length > 0;
  return (
    <div>
      {text && <div className="whitespace-pre-wrap">{text}</div>}
      {hasError && (
        <div className="mt-1 flex items-center gap-2 rounded border border-red-300 bg-red-50 p-2 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <div className="flex-1">
            <span className="font-bold mr-1">ERROR</span>
            <span>{(error as any).message || JSON.stringify(error)}</span>
          </div>
          <Eye
            className="h-4 w-4 cursor-pointer"
            onClick={() => setShowJson(true)}
          />
          <Modal open={showJson} onClose={() => setShowJson(false)}>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(error, null, 2)}
            </pre>
          </Modal>
        </div>
      )}
      {hasResponse && <ExecSuccessItem response={response} />}
    </div>
  );
}
