import {useState, useEffect} from 'react';
import {Pencil} from 'lucide-react';
import {useUser} from '../lib/useUser';
import api from '../lib/axios';

interface Props {
  templateId: string;
  instructions: string;
  onChange?: (text: string) => void;
}

export default function TradingAgentInstructions({templateId, instructions, onChange}: Props) {
  const {user} = useUser();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(instructions);

  useEffect(() => {
    setText(instructions);
  }, [instructions]);

  async function save() {
    if (!user) return;
    await api.patch(
      `/index-templates/${templateId}/instructions`,
      {userId: user.id, agentInstructions: text},
      {headers: {'x-user-id': user.id}}
    );
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
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={save}
            >
              Save
            </button>
            <button
              className="px-4 py-2 border rounded"
              onClick={() => {
                setText(instructions);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap">{instructions}</pre>
      )}
    </div>
  );
}

