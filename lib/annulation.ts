import { toast } from '@/components/power/toaster'

/**
 * Annulation des suppressions : un bouton « Annuler » dans la notification,
 * et Ctrl+Z / Cmd+Z tant que la suppression est récente.
 *
 * Chaque appelant fournit sa propre fonction de restauration (réinsertion en
 * base, ou remise en place dans l'état local quand la sauvegarde automatique
 * réécrit la base d'elle-même).
 */

interface Annulable {
  annuler: () => Promise<boolean> | boolean
  expireLe: number
  faite: boolean
}

const FENETRE_CTRL_Z_MS = 30_000
const DUREE_NOTIFICATION_MS = 8_000
const TAILLE_PILE = 10

const pile: Annulable[] = []
let raccourciInstalle = false

async function executer(entree: Annulable) {
  if (entree.faite) return
  entree.faite = true
  const index = pile.indexOf(entree)
  if (index !== -1) pile.splice(index, 1)
  await entree.annuler()
}

function installerRaccourci() {
  if (raccourciInstalle || typeof window === 'undefined') return
  raccourciInstalle = true
  window.addEventListener('keydown', (evenement) => {
    if (!(evenement.ctrlKey || evenement.metaKey) || evenement.shiftKey || evenement.key.toLowerCase() !== 'z') return
    // Dans un champ, Ctrl+Z doit continuer d'annuler la saisie, pas une suppression.
    const cible = evenement.target as HTMLElement | null
    if (cible && (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))) return
    const maintenant = Date.now()
    const derniere = [...pile].reverse().find((entree) => !entree.faite && entree.expireLe > maintenant)
    if (!derniere) return
    evenement.preventDefault()
    void executer(derniere)
  })
}

export function proposerAnnulation({ message, libelleBouton, annuler }: {
  message: string
  libelleBouton: string
  annuler: () => Promise<boolean> | boolean
}) {
  const entree: Annulable = { annuler, expireLe: Date.now() + FENETRE_CTRL_Z_MS, faite: false }
  pile.push(entree)
  if (pile.length > TAILLE_PILE) pile.shift()
  installerRaccourci()
  toast(message, 'info', {
    action: { label: libelleBouton, onClick: () => void executer(entree) },
    dureeMs: DUREE_NOTIFICATION_MS,
  })
}
