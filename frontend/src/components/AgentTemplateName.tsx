import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import axios from 'axios';
import { useUser } from '../lib/useUser';
import api from '../lib/axios';

interface Props {
  templateId: string;
  name: string;
  onChange?: (name: string) => void;
}

export default function AgentTemplateName({ templateId, name, onChange }: Props) {
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);

  useEffect(() => {
    setText(name);
  }, [name]);

  async function save() {
    if (!user) return;
    try {
      await api.patch(
        `/agent-templates/${templateId}/name`,
        { userId: user.id, name: text },
        { headers: { 'x-user-id': user.id } }
      );
      setEditing(false);
      onChange?.(text);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('Failed to update name');
      }
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <input
          className="border rounded p-1 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="px-2 py-1 bg-blue-600 text-white rounded"
          onClick={save}
        >
          Save
        </button>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => {
            setText(name);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center mb-4">
      <h2 className="text-xl font-bold flex-1">{name}</h2>
      {user && (
        <button
          aria-label="Edit name"
          className="text-gray-600"
          onClick={() => setEditing(true)}
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

