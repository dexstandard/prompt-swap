export function redactKey(key: string, visible = 4): string {
  if (key.length <= visible) return key[0] + '...';
  if (key.length <= visible * 2) return key.slice(0, visible) + '...';
  return key.slice(0, visible) + '...' + key.slice(-visible);
}
