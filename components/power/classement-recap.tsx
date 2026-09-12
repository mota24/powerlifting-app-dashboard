'use client'

import { Dumbbell, Footprints } from 'lucide-react'
import type { Traducteur } from '@/lib/i18n'
import { gagnants, libelleMois, MEDAILLES, palmares, type MoisClasse } from '@/lib/classement'

/**
 * Récapitulatif de la semaine : qui mène, et qui a gagné la précédente.
 * Le classement se joue au mois, mais le dimanche on veut un verdict.
 */
export function RecapSemaine({ courante, passee, dimanche, t }: { courante: MoisClasse; passee?: MoisClasse; dimanche: boolean; t: Traducteur }) {
  const premiers = gagnants(courante.lignes)
  const vainqueurPassee = passee ? gagnants(passee.lignes) : []

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
        {dimanche ? t('resultatsSemaine') : t('semaineEnCours')}
      </h3>
      <ul className="divide-y divide-border">
        {courante.lignes.map((ligne) => (
          <li key={ligne.prenom} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="w-6 text-center text-lg leading-none" aria-hidden>
              {premiers.includes(ligne) ? MEDAILLES[0] : ''}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold text-foreground">{ligne.prenom}</span>
            <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
              <Dumbbell className="size-3.5" aria-label={t('critereSeances')} />{ligne.seances}
              <Footprints className="ml-1 size-3.5" aria-label={t('critere8000')} />{ligne.jours_8000}
            </span>
            <span className="w-14 text-right font-black tabular-nums text-foreground">{ligne.points} {t('pts')}</span>
          </li>
        ))}
      </ul>
      {vainqueurPassee.length === 1 && (
        <p className="text-xs text-muted-foreground">
          {t('semaineDerniere')} · {MEDAILLES[0]} {vainqueurPassee[0].prenom} {vainqueurPassee[0].points} {t('pts')}
        </p>
      )}
    </section>
  )
}

/** Palmarès : un mois par ligne, avec son vainqueur et les totaux. */
export function PalmaresMois({ passes, joueurs, t, locale }: { passes: MoisClasse[]; joueurs: string[]; t: Traducteur; locale: string }) {
  const { victoires, egalites, joues } = palmares(passes, joueurs)

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('palmaresMois')}</h3>
      {joues.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aucunMoisTermine')}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-foreground">
            {t('victoires')} {[...victoires.entries()].map(([prenom, n]) => `${prenom} ${n}`).join(' · ')}
            {egalites > 0 ? ` · ${t('egalites')} ${egalites}` : ''}
          </p>
          <ul className="divide-y divide-border">
            {joues.map((mois) => {
              const premiers = gagnants(mois.lignes)
              return (
                <li key={mois.mois} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="shrink-0 text-muted-foreground">{libelleMois(mois.mois, locale)}</span>
                  <span className="min-w-0 truncate text-right font-bold text-foreground">
                    {premiers.length === 1 ? `${MEDAILLES[0]} ${premiers[0].prenom}` : t('egalite')}
                    <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                      {mois.lignes.map((ligne) => ligne.points).join(' – ')}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
