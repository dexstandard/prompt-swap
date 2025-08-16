interface Props {
  status: 'active' | 'inactive';
}

export default function AgentStatusLabel({ status }: Props) {
  const base = 'px-2 py-1 rounded text-xs font-medium';
  if (status === 'active') {
    return <span className={`${base} bg-green-100 text-green-800`}>Active</span>;
  }
  return <span className={`${base} bg-gray-200 text-gray-800`}>Inactive</span>;
}
