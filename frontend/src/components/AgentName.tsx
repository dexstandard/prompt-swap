import EditableText from './EditableText';

interface Props {
  name: string;
  onChange: (value: string) => void;
}

export default function AgentName({ name, onChange }: Props) {
  return (
    <EditableText
      value={name}
      onChange={onChange}
      className="text-xl font-bold mb-2"
    />
  );
}

