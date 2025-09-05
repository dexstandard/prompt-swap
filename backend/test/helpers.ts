import jwt from 'jsonwebtoken';
import { env } from '../src/util/env.js';

export function authCookies(id: string) {
  return { session: jwt.sign({ id }, env.KEY_PASSWORD) };
}
