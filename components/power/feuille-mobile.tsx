'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModale } from '@/lib/use-modale'

function lireZoneVisible(): { haut: number; hauteur: number } | null {
  if (typeof window === 'undefined' || !window.visualViewport) return null
  return { haut: window.visualViewport.offsetTop, hauteur: window.visualViewport.height }
}

/**
 * Fenêtre qui monte du bas sur téléphone et reste centrée sur grand écran.
 * Hauteur et position sont calées sur la zone réellement visible : quand le
 * clavier s'ouvre, la fenêtre reste au-dessus de lui au lieu de passer dessous.
 */
export function FeuilleMobile({ titre, libelle = titre, libelleFermer, onFermer, children }: {
  titre: string
  libelle?: string
  libelleFermer: string
  onFermer: () => void
  children: ReactNode
}) {
  const [zoneVisible, setZoneVisible] = useState(lireZoneVisible)
  useModale(onFermer)

  useEffect(() => {
    const vue = window.visualViewport
    if (!vue) return
    const suivre = () => setZoneVisible({ haut: vue.offsetTop, hauteur: vue.height })
    vue.addEventListener('resize', suivre)
    vue.addEventListener('scroll', suivre)
    return () => {
      vue.removeEventListener('resize', suivre)
      vue.removeEventListener('scroll', suivre)
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={libelle}
      style={zoneVisible ? { top: zoneVisible.haut, height: zoneVisible.hauteur } : undefined}
      className={cn('fixed inset-x-0 z-[100] flex items-end justify-center overflow-hidden bg-black/90 pt-6 sm:items-center sm:p-4', !zoneVisible && 'inset-y-0')}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:max-h-[92dvh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{titre}</h2>
          <button onClick={onFermer} aria-label={libelleFermer} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="size-5" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
