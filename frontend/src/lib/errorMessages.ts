export const ERROR_MESSAGES = {};

export function lengthMessage(field: string, max: number) {
  return `${field} too long (max ${max})`;
}
