/** Mensagens especificas por tipo de erro (docs secao 6.3) - nunca "erro desconhecido". */
import type { SyncErrorKind } from './client.ts'

export type SyncFailureReason = SyncErrorKind | 'conflict_persisted' | 'schema_outdated'

export const SYNC_ERROR_MESSAGES: Record<SyncFailureReason, string> = {
  offline: 'Sem internet.',
  invalid_url: 'URL do script inválida.',
  unauthorized: 'Token recusado.',
  unexpected_response:
    'Resposta inesperada (provável bloqueio da rede ou página de login do Google).',
  busy: 'O script está ocupado agora.',
  conflict: 'Conflito ao gravar — tentando de novo.',
  conflict_persisted: 'Conflito persistente após 3 tentativas.',
  // Docs secao 6.1: um aparelho com app antigo que encontra uma revisao
  // gravada por uma versao mais nova do schema recusa sincronizar em vez de
  // tentar mesclar algo que nao entende por completo (isso podia descartar
  // campo novo silenciosamente). So acontece depois de atualizar o app em
  // ALGUNS aparelhos mas nao em todos - "atualize" e a acao certa.
  schema_outdated: 'Versão do app desatualizada — atualize para sincronizar.',
}
