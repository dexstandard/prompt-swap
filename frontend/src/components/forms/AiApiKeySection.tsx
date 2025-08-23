import ApiKeySection from './ApiKeySection';

export default function AiApiKeySection({ label }: { label: string }) {
  return (
    <ApiKeySection
      label={label}
      queryKey="ai-key"
      getKeyPath={(id) => `/users/${id}/ai-key`}
      fields={[{ name: 'key', placeholder: 'API key' }]}
      videoGuideUrl="https://www.youtube.com/watch?v=WjVf80HUvYg"
    />
  );
}

