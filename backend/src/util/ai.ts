const developerInstructions =
  'You assist a real trader in taking decisions on a given tokens configuration. Use the web search tool to find fresh news and prices and advise the user whether to rebalance or not.';

export async function callAi(
  model: string,
  input: unknown,
  apiKey: string,
  previousResponses: string[],
): Promise<string> {
  const schema = {
    type: 'object',
    properties: {
      result: {
        anyOf: [
          {
            type: 'object',
            properties: {
              rebalance: { type: 'boolean', const: false },
              shortReport: { type: 'string' },
            },
            required: ['rebalance', 'shortReport'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              rebalance: { type: 'boolean', const: true },
              newAllocation: { type: 'number' },
              shortReport: { type: 'string' },
            },
            required: ['rebalance', 'newAllocation', 'shortReport'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
            required: ['error'],
            additionalProperties: false,
          },
        ],
      },
    },
    required: ['result'],
    additionalProperties: false,
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: typeof input === 'string' ? input : JSON.stringify(input),
      developer: developerInstructions,
      previous_responses: previousResponses,
      tools: [{ type: 'web_search_preview' }],
      text: {
        format: {
          type: 'json_schema',
          name: 'rebalance_response',
          strict: true,
          schema,
        },
      },
    }),
  });
  return await res.text();
}
