export const ERROR_MESSAGES: Record<string, string> = {
  'invalid token': 'invalid_token',
  'not enabled': 'not_enabled',
  'verification failed': 'verification_failed',
  forbidden: 'forbidden',
  'not found': 'not_found',
  'user not found': 'user_not_found',
  'share not found': 'share_not_found',
  'manual rebalance disabled': 'manual_rebalance_disabled',
  'order already exists for log': 'order_exists_for_log',
  'no rebalance info': 'no_rebalance_info',
  'missing api keys': 'missing_api_keys',
  'failed to fetch balances': 'failed_fetch_balances',
  'order value below minimum': 'order_value_below_minimum',
  'order not found': 'order_not_found',
  'order not open': 'order_not_open',
  'no rebalance needed': 'no_rebalance_needed',
  'failed to fetch account': 'failed_fetch_account',
  'failed to fetch models': 'failed_fetch_models',
  'failed to fetch earn balance': 'failed_fetch_earn_balance',
  'key exists': 'key_exists',
  'invalid cash token': 'invalid_cash_token',
  'invalid tokens': 'invalid_tokens',
  'cash token in positions': 'cash_token_in_positions',
  'invalid status': 'invalid_status',
  'model not allowed': 'model_not_allowed',
  'failed to fetch balance': 'failed_fetch_balance',
  'invalid minimum allocations': 'invalid_minimum_allocations',
  'invalid path parameter': 'invalid_path_parameter',
  'user disabled': 'user_disabled',
  'otp required': 'otp_required',
  'invalid otp': 'invalid_otp',
  'agent not active': 'agent_not_active',
  'model required': 'model_required',
};

export const ERROR_MESSAGE_PREFIXES: Record<string, string> = {
  'Too many requests': 'too_many_requests',
};

export function lengthMessage(field: string, max: number) {
  return `${field} too long (max ${max})`;
}
