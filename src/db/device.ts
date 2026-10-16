/**
 * Nome do aparelho: identifica quem fez cada escrita (docs secao 5.8),
 * usado em `tasks.device` e em todo `task_events.device` para a mesclagem
 * de sync (fase 2) desempatar edicoes simultaneas.
 *
 * A tela de Configuracoes para renomear o aparelho e da fase 2. Ate la, um
 * nome razoavel e detectado pelo user agent - "celular" ou "computador" -
 * e guardado so no aparelho.
 */
import { storageKey } from '@/appId.ts'

const DEVICE_STORAGE_KEY = storageKey('matriz:device')

function detectDefaultDeviceName(): string {
  return /Mobi|Android/iu.test(navigator.userAgent) ? 'celular' : 'computador'
}

export function getDeviceName(): string {
  try {
    const stored = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (stored !== null && stored.trim() !== '') return stored
  } catch {
    // Armazenamento bloqueado (navegacao privada, por exemplo): usa o padrao.
  }
  return detectDefaultDeviceName()
}

export function setDeviceName(name: string): void {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, name)
  } catch {
    // Sem armazenamento, o nome vale so para esta sessao.
  }
}
