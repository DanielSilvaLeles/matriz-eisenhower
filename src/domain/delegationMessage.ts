/**
 * Monta o texto de "Copiar mensagem de delegação" (docs secao 5.4, Q3): o
 * quê, por que é urgente, resultado esperado e prazo - a partir dos campos
 * que já estão na própria tarefa, sem pedir nada de novo na hora de copiar.
 */
import type { Task } from './schema.ts'

function formatDateBr(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function buildDelegationMessage(task: Task): string {
  const lines: string[] = [`Oi! Pode me ajudar com: ${task.title}`]

  if (task.delegation_context !== null && task.delegation_context.trim() !== '') {
    lines.push(`Por que é urgente: ${task.delegation_context.trim()}`)
  }
  if (task.expected_outcome !== null && task.expected_outcome.trim() !== '') {
    lines.push(`Resultado esperado: ${task.expected_outcome.trim()}`)
  }
  if (task.date !== null) {
    lines.push(`Prazo para retorno: ${formatDateBr(task.date)}`)
  }

  lines.push('Obrigado!')
  return lines.join('\n')
}
