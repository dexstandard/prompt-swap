import ApiKeySection from './ApiKeySection';

const aiFields = [{ name: 'key', placeholder: 'API key' }];

export default function AiApiKeySection({ label }: { label: string }) {
  return (
    <ApiKeySection
      label={label}
      queryKey="ai-key"
      getKeyPath={(id) => `/users/${id}/ai-key`}
      fields={aiFields}
      videoGuideUrl="https://www.youtube.com/watch?v=WjVf80HUvYg"
    />
  );
}

