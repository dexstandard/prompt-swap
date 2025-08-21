import { useState } from 'react';
import { CheckCircle, Eye } from 'lucide-react';
import Modal from './ui/Modal';

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

  return (
    <div className="mt-1 flex items-center gap-2 rounded border border-green-300 bg-green-50 p-2 text-green-800">
      <CheckCircle className="h-4 w-4" />
      <div className="flex-1 whitespace-pre-wrap break-words">
        <span className="font-bold mr-1">SUCCESS</span>
        <span>{shortReport}</span>
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

