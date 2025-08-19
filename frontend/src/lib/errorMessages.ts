export const ERROR_MESSAGES = {
  agentExists: 'agent already exists',
};

export function lengthMessage(field: string, max: number) {
  return `${field} too long (max ${max})`;
}
