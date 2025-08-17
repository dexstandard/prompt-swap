import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { useUser } from '../lib/useUser';
import api from '../lib/axios';

interface AgentInstructions {
  webSearchStrategy: string;
  goal: string;
}

interface Props {
  templateId: string;
  instructions: AgentInstructions;
  onChange?: (value: AgentInstructions) => void;
}

export default function TradingAgentInstructions({
  templateId,
  instructions,
  onChange,
}: Props) {
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<AgentInstructions>(instructions);

  useEffect(() => {
    setLocal(instructions);
  }, [instructions]);

  async function save() {
    if (!user) return;
    await api.patch(
      `/agent-templates/${templateId}/instructions`,
      { userId: user.id, agentInstructions: local },
      { headers: { 'x-user-id': user.id } }
    );
    setEditing(false);
    onChange?.(local);
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
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="webSearchStrategy">
              Web Search Strategy
            </label>
            <textarea
              id="webSearchStrategy"
              className="w-full border rounded p-2"
              rows={2}
              value={local.webSearchStrategy}
              onChange={(e) =>
                setLocal({ ...local, webSearchStrategy: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="goal">
              Goal
            </label>
            <textarea
              id="goal"
              className="w-full border rounded p-2"
              rows={4}
              value={local.goal}
              onChange={(e) => setLocal({ ...local, goal: e.target.value })}
            />
          </div>
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
                setLocal(instructions);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p>
            <strong>Web Search Strategy:</strong> {instructions.webSearchStrategy}
          </p>
          <p>
            <strong>Goal:</strong> {instructions.goal}
          </p>
        </div>
      )}
    </div>
  );
}

