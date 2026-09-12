'use client'

import { Droplets, Minus, Plus } from 'lucide-react'
import type { Traducteur } from '@/lib/i18n'
import { EAU_CLASSEMENT_ML, VERRE_ML, ajusterEau, enLitres, etatObjectif } from '@/lib/nutrition'

/**
 * Eau du jour : deux boutons, un verre à la fois. L'objectif affiché est
 * l'objectif personnel, à défaut le seuil du classement.
 */
export function CarteEau({ ml, objectif, t, locale, onChange }: {
  ml: number
  objectif: number | null
  t: Traducteur
  locale: string
  onChange: (ml: number) => void
}) {
  const cible = objectif ?? EAU_CLASSEMENT_ML
  const suivi = etatObjectif(ml, cible, true)
  const quantite = (valeur: number) => `${enLitres(valeur, locale)} L`

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Droplets className="size-3.5" aria-hidden /> {t('eau')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onChange(ajusterEau(ml, -VERRE_ML))}
            disabled={ml === 0}
            aria-label={t('retirerVerre')}
            className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
          <button
            onClick={() => onChange(ajusterEau(ml, VERRE_ML))}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" /> {t('verre', { n: VERRE_ML })}
          </button>
        </div>
      </div>

      <p className="mt-1 text-3xl font-black tabular-nums text-foreground">
        {enLitres(ml, locale)} <span className="text-sm font-bold text-muted-foreground">L</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${suivi.part * 100}%` }} />
      </div>
      <p className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {t('objectifCourt', { n: quantite(cible) })}
      </p>
      <p className="truncate text-[10px] font-black uppercase tracking-widest text-foreground">
        {suivi.etat === 'reste' ? t('reste', { n: quantite(suivi.ecart) }) : t('objectifAtteint')}
      </p>
    </div>
  )
}
