import { createHmac } from 'node:crypto';
import { encrypt, decrypt } from './crypto.js';
import { env } from './env.js';
import { errorResponse, type ErrorResponse } from './errorMessages.js';

export enum ApiKeyType {
  Ai = 'ai',
  Binance = 'binance',
}

export async function verifyApiKey(
  type: ApiKeyType,
  key: string,
  secret?: string,
): Promise<boolean> {
  if (type === ApiKeyType.Ai) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  try {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = createHmac('sha256', secret!)
      .update(query)
      .digest('hex');
    const res = await fetch(
      `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': key },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function encryptKey(value: string) {
  return encrypt(value, env.KEY_PASSWORD);
}

export function decryptKey(value: string) {
  return decrypt(value, env.KEY_PASSWORD);
}

export interface ValidationErr {
  code: number;
  body: ErrorResponse;
}

export function ensureUser(row: unknown): ValidationErr | null {
  if (!row) return { code: 404, body: errorResponse('user not found') };
  return null;
}

export function ensureKeyAbsent(row: any, fields: string[]): ValidationErr | null {
  if (fields.some((f) => row?.[f]))
    return { code: 400, body: errorResponse('key exists') };
  return null;
}

export function ensureKeyPresent(row: any, fields: string[]): ValidationErr | null {
  if (fields.some((f) => !row?.[f]))
    return { code: 404, body: errorResponse('not found') };
  return null;
}
