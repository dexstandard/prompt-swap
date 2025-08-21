export interface ParsedExecLog {
  text: string;
  response?: {
    rebalance: boolean;
    newAllocation?: number;
    shortReport: string;
  };
  error?: Record<string, unknown>;
}

export function parseExecLog(log: string): ParsedExecLog {
  let text = log;
  let response: ParsedExecLog['response'];
  let error: Record<string, unknown> | undefined;
  try {
    const parsed = JSON.parse(log);
    if (parsed && typeof parsed === 'object') {
      if ('error' in parsed) {
        error = (parsed as any).error as Record<string, unknown>;
        const { error: _err, ...rest } = parsed as any;
        text = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
      } else if ((parsed as any).object === 'response') {
        const outputs = Array.isArray((parsed as any).output)
          ? (parsed as any).output
          : [];
        const msg = outputs.find((o: any) => o.type === 'message');
        const textPart = msg?.content?.find((c: any) => c.type === 'output_text');
        if (textPart && typeof textPart.text === 'string') {
          text = textPart.text;
          try {
            const out = JSON.parse(textPart.text);
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
  } catch {
    // ignore parse errors
  }
  return { text, response, error };
}
