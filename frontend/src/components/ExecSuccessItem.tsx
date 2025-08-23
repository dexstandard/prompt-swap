import { useState } from 'react';
import { Eye } from 'lucide-react';
import Modal from './ui/Modal';

const MAX_LEN = 255;
function truncate(text: string) {
  return text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '…' : text;
}

interface Props {
  response: {
    rebalance: boolean;
    newAllocation?: number;
    shortReport: string;
  };
}

export default function ExecSuccessItem({ response }: Props) {
  const [showJson, setShowJson] = useState(false);
  const { rebalance, newAllocation, shortReport } = response;
  const color = rebalance
    ? 'border-green-300 bg-green-50 text-green-800'
    : 'border-blue-300 bg-blue-50 text-blue-800';

  return (
    <div className={`mt-1 flex items-center gap-2 rounded border p-2 ${color}`}>
      <div className="flex-1 whitespace-pre-wrap break-words">
        <span className="font-bold mr-1">
          {rebalance ? 'Rebalanced' : 'Hold'}
        </span>
        <span>{truncate(shortReport)}</span>
        {rebalance && typeof newAllocation === 'number' && (
          <span className="ml-1">(new allocation: {newAllocation})</span>
        )}
      </div>
      <Eye
        className="h-4 w-4 cursor-pointer"
        onClick={() => setShowJson(true)}
      />
      <Modal open={showJson} onClose={() => setShowJson(false)}>
        <pre className="whitespace-pre-wrap break-words text-sm">
          {JSON.stringify(response, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}

