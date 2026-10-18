import { useState } from 'react'
import { useRoute } from '@/ui/router/useRoute.ts'
import { BottomNav } from './BottomNav.tsx'
import { TarefaSheet } from './TarefaSheet.tsx'

/**
 * Agrupa o menu inferior + a folha "Tarefa" (renomeada de "Ideia" a
 * pedido do usuário - estado de abrir/fechar fica aqui, não em App.tsx) -
 * só para App.tsx não estourar o limite de imports do lint, mesmo motivo
 * de AppHeaderActions.tsx/GlobalOverlays.tsx.
 *
 * A barra some sozinha no editor de anotação em tela cheia (seção 3.1: "no
 * editor, ela dá lugar a uma barra de edição com Voltar e salvamento") -
 * `NoteEditor.tsx` já renderiza essa barra própria; aqui só decide não
 * duplicar a navegação por baixo dela.
 */
export function MobileQuickActions() {
  const route = useRoute()
  const [tarefaOpen, setTarefaOpen] = useState(false)

  return (
    <>
      {route.screen === 'note-editor' ? null : (
        <BottomNav
          onOpenTarefa={() => {
            setTarefaOpen(true)
          }}
        />
      )}
      <TarefaSheet open={tarefaOpen} onOpenChange={setTarefaOpen} />
    </>
  )
}
