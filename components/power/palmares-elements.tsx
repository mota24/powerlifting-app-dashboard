'use client'

import { countryCodeToFlag, countryName } from '@/lib/countries'
import { cn } from '@/lib/utils'
import { formatKg, type Attempt } from '@/lib/palmares'

// Petits éléments d'affichage partagés par les vues du palmarès.

/**
 * Drapeau du pays, émoji seul — le nom n'est jamais écrit à l'écran, il ne
 * sert que d'étiquette d'accessibilité (invisible, lue par les lecteurs
 * d'écran). `tracking-normal` annule le letter-spacing hérité du texte
 * environnant, qui décalerait l'émoji vers la gauche, et `leading-none`
 * l'empêche d'augmenter la hauteur de ligne.
 */
export function CountryFlag({ code }: { code: string | null }) {
  const flag = countryCodeToFlag(code)
  if (!flag) return null
  return (
    <span
      role="img"
      aria-label={countryName(code) ?? 'Pays'}
      className="shrink-0 text-[13px] leading-none tracking-normal"
    >
      {flag}
    </span>
  )
}

export function AttemptValue({ value }: { value: Attempt }) {
  if (value == null) return <span className="font-mono text-sm text-zinc-800">—</span>
  const failed = value < 0
  return (
    <span
      className={cn(
        'font-mono text-sm font-bold tabular-nums',
        failed ? 'text-zinc-600 line-through decoration-zinc-700' : 'text-white'
      )}
      title={failed ? 'Essai manqué' : 'Essai validé'}
    >
      {failed ? `−${formatKg(Math.abs(value))}` : formatKg(value)}
    </span>
  )
}
