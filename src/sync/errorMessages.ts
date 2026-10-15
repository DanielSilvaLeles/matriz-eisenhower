/** Mensagens especificas por tipo de erro (docs secao 6.3) - nunca "erro desconhecido". */
import type { SyncErrorKind } from './client.ts'

export type SyncFailureReason = SyncErrorKind | 'conflict_persisted'

export const SYNC_ERROR_MESSAGES: Record<SyncFailureReason, string> = {
  offline: 'Sem internet.',
  invalid_url: 'URL do script inválida.',
  unauthorized: 'Token recusado.',
  unexpected_response:
    'Resposta inesperada (provável bloqueio da rede ou página de login do Google).',
  busy: 'O script está ocupado agora.',
  conflict: 'Conflito ao gravar — tentando de novo.',
  conflict_persisted: 'Conflito persistente após 3 tentativas.',
}
