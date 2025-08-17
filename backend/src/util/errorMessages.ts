export const ERROR_MESSAGES = {
  templateExists: 'template already exists',
  agentExists: 'agent already exists',
  forbidden: 'forbidden',
  notFound: 'not found',
};

export function lengthMessage(field: string, max: number) {
  return `${field} too long (max ${max})`;
}

export function errorResponse(message: string) {
  return { error: message };
}
