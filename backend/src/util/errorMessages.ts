export const ERROR_MESSAGES = {
  forbidden: 'forbidden',
  notFound: 'not found',
};

export function lengthMessage(field: string, max: number) {
  return `${field} too long (max ${max})`;
}

export function errorResponse(message: string) {
  return { error: message };
}
