/**
 * Mutações de anotação: criar, editar, apagar (lógico), restaurar.
 *
 * Mesmo padrão de `src/domain/task.ts`: toda função é pura, recebe `now` e
 * `id` como parâmetro em vez de gerar por conta própria - a camada impura
 * (`src/db/notesRepo.ts`) é quem gera e grava.
 */
import { extractNoteTags } from './noteTags.ts'
import type { Note } from './schema.ts'

export interface NewNoteInput {
  readonly id: string
  readonly body: string
  readonly title?: string | null
  readonly device: string
}

/**
 * `docs/prompt-anotacoes.md` seção 5: "a anotação só passa a existir quando
 * eu digito o primeiro caractere" - esta função só é chamada depois disso
 * (`src/db/notesRepo.ts` decide quando chamar, não aqui); aqui `body` já
 * não pode ser vazio.
 */
export function createNote(input: NewNoteInput, now: string): Note {
  if (input.body.trim() === '') {
    throw new Error('Corpo da anotação não pode ser vazio ao criar.')
  }

  const title = input.title?.trim()
  return {
    id: input.id,
    title: title === undefined || title === '' ? null : title,
    body: input.body,
    tags: [...extractNoteTags(input.body)],
    created_at: now,
    updated_at: now,
    deleted: false,
    deleted_at: null,
    device: input.device,
  }
}

export interface NoteFieldEdits {
  readonly title?: string | null
  readonly body?: string
}

/**
 * `created_at` nunca é tocado aqui - "a data de inclusão nunca muda depois
 * de criada" (seção 5). Tags são recalculadas só quando `body` muda.
 */
export function editNote(note: Note, edits: NoteFieldEdits, device: string, now: string): Note {
  const body = edits.body ?? note.body
  const title = edits.title === undefined ? note.title : edits.title

  return {
    ...note,
    title,
    body,
    tags: edits.body === undefined ? note.tags : [...extractNoteTags(body)],
    updated_at: now,
    device,
  }
}

/** Exclusão lógica - toast "Desfazer" e lixeira de 30 dias (seção 5), não um delete físico. */
export function deleteNote(note: Note, device: string, now: string): Note {
  return { ...note, deleted: true, deleted_at: now, updated_at: now, device }
}

export function restoreNote(note: Note, device: string, now: string): Note {
  return { ...note, deleted: false, deleted_at: null, updated_at: now, device }
}

const LIST_MARKER_PATTERN = /^(\s*)((?:- \[ \] )|(?:\[ \] )|(?:- ))/u

/**
 * `docs/prompt-anotacoes.md` seção 5: "ao dar Enter numa linha que começa
 * com '- ' ou '[ ] ', a nova linha continua o mesmo marcador." Devolve o
 * prefixo a inserir na linha nova, ou `null` se a linha atual não tiver
 * marcador de lista. Pura: recebe o texto da linha onde o cursor estava,
 * não mexe em DOM nem em posição de cursor (isso é da UI).
 */
export function continuationPrefixFor(currentLine: string): string | null {
  const match = LIST_MARKER_PATTERN.exec(currentLine)
  if (!match) return null
  const [, indent, marker] = match
  // Linha so com o marcador e nada mais (ex.: "- " sozinho): Enter encerra a
  // lista em vez de repetir o marcador para sempre - mesmo comportamento que
  // editores de texto simples costumam ter.
  if (currentLine.trim() === marker?.trim()) return null
  return `${indent ?? ''}${marker ?? ''}`
}
