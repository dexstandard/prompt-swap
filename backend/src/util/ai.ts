export async function callAi(model: string, input: unknown, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: typeof input === 'string' ? input : JSON.stringify(input),
      tools: [{ type: 'web_search_preview' }],
    }),
  });
  return await res.text();
}
