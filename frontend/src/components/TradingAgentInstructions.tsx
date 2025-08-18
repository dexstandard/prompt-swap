import {useState, useEffect} from 'react';
import {Pencil} from 'lucide-react';
import {useUser} from '../lib/useUser';
import api from '../lib/axios';
import Button from './ui/Button';

interface Props {
  templateId: string;
  instructions: string;
  onChange?: (text: string) => void;
}

export default function TradingAgentInstructions({templateId, instructions, onChange}: Props) {
  const {user} = useUser();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(instructions);
  const MAX_LENGTH = 2000;

  useEffect(() => {
    setText(instructions);
  }, [instructions]);

  async function save() {
    if (!user) return;
    await api.patch(`/agent-templates/${templateId}/instructions`, {
      userId: user.id,
      agentInstructions: text,
    });
    setEditing(false);
    onChange?.(text);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center mb-2">
        <h2 className="text-xl font-bold flex-1">Trading Agent Instructions</h2>
        {user && (
          <button
            aria-label="Edit"
            className="text-gray-600"
            onClick={() => setEditing((e) => !e)}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="text-sm text-gray-600 text-right mt-1">
            {text.length}/{MAX_LENGTH}
          </div>
          <div className="mt-2 flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setText(instructions);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap">{instructions}</pre>
      )}
    </div>
  );
}

