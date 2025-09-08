import { type ReactNode } from 'react';
import ApiKeySection from './ApiKeySection';

const aiFields = [{ name: 'key', placeholder: 'API key' }];

export default function AiApiKeySection({
  label,
  allowShare = false,
}: {
  label: ReactNode;
  allowShare?: boolean;
}) {
  return (
    <ApiKeySection
      label={label}
      queryKey="ai-key"
      getKeyPath={(id) => `/users/${id}/ai-key`}
      sharePath={allowShare ? (id) => `/users/${id}/ai-key/share` : undefined}
      fields={aiFields}
      videoGuideUrl="https://www.youtube.com/watch?v=WjVf80HUvYg"
    />
  );
}

