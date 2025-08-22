const developerInstructions =
  "You assist a real trader in taking decisions on a given tokens configuration. Users may deposit or withdraw funds between runs; if the current balance doesn't match previous executions, treat the session as new. The user's comment may be found in the trading instructions field. Use the web search tool to find fresh news and prices and advise the user whether to rebalance or not. Fit report comment in 255 characters. If you suggest rebalancing, provide the new allocation in percentage (0-100) for the first token in the pair. If you don't suggest rebalancing, set rebalance to false and provide a short report comment. If you encounter an error, return an object with an error message.";

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
      input:
        typeof input === 'string'
          ? JSON.stringify({ prompt: input, previous_responses: previousResponses })
          : JSON.stringify({ ...(input as Record<string, unknown>), previous_responses: previousResponses }),
      instructions: developerInstructions,
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
