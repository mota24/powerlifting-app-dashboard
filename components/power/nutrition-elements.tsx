'use client'

import type { Traducteur } from '@/lib/i18n'
import { etatObjectif } from '@/lib/nutrition'

export const arrondi = (n: number) => Math.round(n)
export const arrondi1 = (n: number) => Math.round(n * 10) / 10

export function Total({ libelle, valeur, arrondir, unite, objectif, depasserReussit, t, locale }: {
  libelle: string
  valeur: number
  arrondir: (n: number) => number
  unite: string
  objectif: number | null
  depasserReussit: boolean
  t: Traducteur
  locale: string
}) {
  const suivi = objectif !== null ? etatObjectif(valeur, objectif, depasserReussit) : null
  const quantite = (n: number) => `${n.toLocaleString(locale)} ${unite}`
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{libelle}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-foreground">
        {arrondir(valeur).toLocaleString(locale)} <span className="text-sm font-bold text-muted-foreground">{unite}</span>
      </p>
      {objectif !== null && suivi && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${suivi.part * 100}%` }} />
          </div>
          <p className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('objectifCourt', { n: quantite(objectif) })}</p>
          <p className="truncate text-[10px] font-black uppercase tracking-widest text-foreground">
            {suivi.etat === 'reste' ? t('reste', { n: quantite(suivi.ecart) }) : suivi.etat === 'atteint' ? t('objectifAtteint') : t('objectifDepasse', { n: quantite(suivi.ecart) })}
          </p>
        </>
      )}
    </div>
  )
}
