/**
 * Aviso previo de payload grande (docs/prompt-anotacoes.md secao 6.3): o
 * Apps Script recusa qualquer corpo acima de `MAX_PAYLOAD_BYTES` (ver
 * `apps-script/Code.gs`, mesmo valor, duplicado de proposito - os dois
 * lados nao compartilham modulo, igual ao checksum). Anotacoes crescem
 * muito mais que tarefas; o objetivo e avisar com antecedencia e sugerir
 * exportar/arquivar, nunca deixar o push falhar em silencio so quando
 * já estourou.
 */
export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024

const WARNING_RATIO = 0.8
export const PAYLOAD_WARNING_THRESHOLD_BYTES = Math.floor(MAX_PAYLOAD_BYTES * WARNING_RATIO)

export function payloadByteSize(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length
}

export function isPayloadNearLimit(data: unknown): boolean {
  return payloadByteSize(data) >= PAYLOAD_WARNING_THRESHOLD_BYTES
}
