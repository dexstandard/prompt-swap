import {useState, useEffect} from 'react';
import {Pencil} from 'lucide-react';
import {useUser} from '../lib/useUser';
import api from '../lib/axios';
import Button from './ui/Button';

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
            className="border rounded p-1 mr-2 w-full max-w-[33ch]"
            value={text}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setText(e.target.value)}
          />
          <Button className="mr-2" onClick={save}>
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setText(name);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span>{name}</span>
          {user && (
            <button
              aria-label="Edit name"
              className="text-gray-600 ml-2"
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

