export interface Analysis {
  comment: string;
  score: number;
}

export const analysisSchema = {
  type: 'object',
  properties: {
    comment: { type: 'string' },
    score: { type: 'number' },
  },
  required: ['comment', 'score'],
  additionalProperties: false,
} as const;
