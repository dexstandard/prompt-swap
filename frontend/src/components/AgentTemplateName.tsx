import {useState, useEffect} from 'react';
import {Pencil} from 'lucide-react';
import {useUser} from '../lib/useUser';
import api from '../lib/axios';

interface Props {
  templateId: string;
  name: string;
  onChange?: (name: string) => void;
}

const MAX_NAME_LENGTH = 50;

export default function AgentTemplateName({templateId, name, onChange}: Props) {
  const {user} = useUser();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);

  useEffect(() => {
    setText(name);
  }, [name]);

  async function save() {
    if (!user) return;
    await api.patch(
      `/agent-templates/${templateId}/name`,
      {userId: user.id, name: text},
      {headers: {'x-user-id': user.id}}
    );
    setEditing(false);
    onChange?.(text);
  }

  return (
    <p className="flex items-center mt-4">
      <strong className="mr-2">Name:</strong>
      {editing ? (
        <>
          <input
            className="border rounded p-1 flex-1 mr-2"
            value={text}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded mr-2"
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
        </>
      ) : (
        <>
          <span>{name}</span>
          {user && (
            <button
              aria-label="Edit name"
              className="text-gray-600 ml-1"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </>
      )}
    </p>
  );
}

