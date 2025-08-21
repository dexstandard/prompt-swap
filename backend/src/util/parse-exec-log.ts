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
    if ('error' in parsed) {
      error = (parsed as any).error as Record<string, unknown>;
      const { error: _err, ...rest } = parsed as any;
      text = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
    } else if ((parsed as any).object === 'response') {
      const outputs = Array.isArray((parsed as any).output)
        ? (parsed as any).output
        : [];
      // final assistant reply is in the output entry whose id starts with "msg_"
      // and the text lives at content[0].text
      const msg = outputs.find(
        (o: any) => typeof o?.id === 'string' && o.id.startsWith('msg_'),
      );
      const textField = Array.isArray(msg?.content)
        ? msg.content[0]?.text
        : undefined;
      if (typeof textField === 'string') {
        text = textField;
        try {
          const out = JSON.parse(textField);
          if (out && typeof out === 'object' && 'result' in out) {
            const result = (out as any).result;
            if (result && typeof result === 'object') {
              if ('error' in result) {
                error = { message: (result as any).error };
              } else {
                response = result as ParsedExecLog['response'];
              }
            }
          }
        } catch {
          // ignore
        }
      } else {
        text = '';
      }
    }
  }

  return { text, response, error };
}
