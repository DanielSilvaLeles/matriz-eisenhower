/** Objeto JSON comum (não array, não null) - o guard usado em toda a API. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
