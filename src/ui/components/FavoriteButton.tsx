import { Star } from 'lucide-react'
import { cn } from '@/lib/utils.ts'

export interface FavoriteButtonProps {
  favorite: boolean
  onToggle: () => void
  /**
   * Nome do item, para o rótulo acessível ("Favoritar "X"" / "Remover "X"
   * das favoritas"). Ausente = rótulo genérico ("Favoritar") - usado na
   * lista de anotações, onde a estrela fica logo depois do botão da linha
   * (que já diz o título) e repetir o título faria a busca por nome
   * acessível da linha bater em dois botões.
   */
  itemLabel?: string
  /** Classes extras do botão (tamanho, visibilidade em hover). */
  className?: string
  iconClassName?: string
}

/**
 * Estrela de favorita, a mesma em tarefa e anotação. Cor `warn` (âmbar),
 * já provada AA como texto (4.5:1) em `tokens.contrast.test.ts` nos dois
 * temas - folga sobre os 3:1 que um ícone precisa, sem token novo.
 * `aria-pressed` diz o estado ao leitor de tela; o rótulo muda junto para
 * quem não lê o estado de botão alternável.
 */
export function FavoriteButton({
  favorite,
  onToggle,
  itemLabel,
  className,
  iconClassName = 'size-3.5',
}: FavoriteButtonProps) {
  const title = favorite ? 'Remover das favoritas' : 'Favoritar'
  const label =
    itemLabel === undefined
      ? title
      : favorite
        ? `Remover "${itemLabel}" das favoritas`
        : `Favoritar "${itemLabel}"`
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      aria-pressed={favorite}
      aria-label={label}
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded hover:bg-surface-muted',
        favorite ? 'text-warn' : 'text-text-subtle hover:text-text',
        className,
      )}
    >
      <Star className={cn(iconClassName, favorite && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
