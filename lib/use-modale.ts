'use client'

import { useEffect } from 'react'

/**
 * Fenêtre au premier plan : la page derrière est figée (sinon iOS la fait
 * défiler quand le clavier s'ouvre) et Échap referme, si une fermeture est fournie.
 */
export function useModale(onFermer?: () => void) {
  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer?.() }
    window.addEventListener('keydown', surTouche)
    return () => {
      document.body.style.overflow = precedent
      window.removeEventListener('keydown', surTouche)
    }
  }, [onFermer])
}
