import { useState } from 'react';
import { CheckCircle, Eye } from 'lucide-react';
import Modal from './ui/Modal';

interface Props {
  response: Record<string, any>;
}

export default function ExecSuccessItem({ response }: Props) {
  const [showJson, setShowJson] = useState(false);

  let message = '';
  const outputs = Array.isArray(response.output) ? response.output : [];
  const msg = outputs.find((o) => o.type === 'message');
  if (msg && Array.isArray(msg.content)) {
    const textPart = msg.content.find((c: any) => c.type === 'output_text');
    if (textPart && typeof textPart.text === 'string') message = textPart.text;
  }

  return (
    <div className="mt-1 flex items-center gap-2 rounded border border-green-300 bg-green-50 p-2 text-green-800">
      <CheckCircle className="h-4 w-4" />
      <div className="flex-1 whitespace-pre-wrap break-words">
        <span className="font-bold mr-1">SUCCESS</span>
        <span>{message}</span>
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

