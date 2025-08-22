export interface ParsedExecLog {
  text: string;
  response?: {
    rebalance: boolean;
    newAllocation?: number;
    shortReport: string;
  };
  error?: Record<string, unknown>;
}

export function parseExecLog(log: unknown): ParsedExecLog {
  let text =
      typeof log === 'string'
          ? log
          : log !== undefined
              ? JSON.stringify(log)
              : '';

  let response: ParsedExecLog['response'];
  let error: Record<string, unknown> | undefined;

  let parsed: any;
  try {
    parsed = typeof log === 'string' ? JSON.parse(log) : log;
  } catch {
    return { text, response, error };
  }

  if (parsed && typeof parsed === 'object') {
    // *** FIX: only treat as error if value is truthy, not when it's null ***
    if ('error' in parsed && parsed.error) {
      error = parsed.error as Record<string, unknown>;
      const { error: _err, ...rest } = parsed as any;
      text = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
      return { text, response, error };
    }

    if ((parsed as any).object === 'response') {
      const outputs = Array.isArray((parsed as any).output)
          ? (parsed as any).output
          : [];

      const msg = outputs.find(
          (o: any) =>
              typeof o?.id === 'string' &&
              (o.id.startsWith('msg_') || o.type === 'message')
      );

      const textField = Array.isArray(msg?.content)
          ? msg.content[0]?.text
          : undefined;

      if (typeof textField === 'string') {
        text = textField;

        try {
          const sanitized = textField.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
          const out = JSON.parse(sanitized);

          if (out && typeof out === 'object' && 'result' in out) {
            const result = (out as any).result;

            if (result && typeof result === 'object') {
              if ('error' in result && result.error) {
                error = {
                  message:
                      typeof result.error === 'string'
                          ? result.error
                          : JSON.stringify(result.error),
                };
              } else if ('rebalance' in result) {
                const r = result as {
                  rebalance: boolean;
                  newAllocation?: number | string;
                  shortReport?: string;
                };
                const newAllocation =
                    r.newAllocation === undefined
                        ? undefined
                        : typeof r.newAllocation === 'number'
                            ? r.newAllocation
                            : Number(r.newAllocation);

                response = {
                  rebalance: !!r.rebalance,
                  ...(newAllocation !== undefined ? { newAllocation } : {}),
                  shortReport: typeof r.shortReport === 'string' ? r.shortReport : '',
                };
              }
            }
          }
        } catch {
          const rebalanceMatch = textField.match(/"rebalance"\s*:\s*(true|false)/i);
          const reportMatch = textField.match(/"shortReport"\s*:\s*"([\s\S]*?)"/i);
          if (rebalanceMatch && reportMatch) {
            response = {
              rebalance: rebalanceMatch[1].toLowerCase() === 'true',
              shortReport: reportMatch[1],
            };
            const allocMatch = textField.match(
                /"newAllocation"\s*:\s*([0-9]+(?:\.[0-9]+)?|[0-9.eE+-]+)/i
            );
            if (allocMatch) response.newAllocation = Number(allocMatch[1]);
          }
        }
      } else {
        text = JSON.stringify(parsed);
      }
    }
  }

  return { text, response, error };
}
