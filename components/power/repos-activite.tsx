'use client'

import { HeartPulse } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Traducteur } from '@/lib/i18n'
import { ACTIVITES_REPOS, MINUTES_REPOS_MINI, reposActif, type ActiviteRepos } from '@/lib/seance'

/** Un jour de repos reste un jour de repos : bouger un peu est un bonus, jamais une obligation. */
export function BlocReposActif({ activite, t, onChange }: {
  activite: ActiviteRepos
  t: Traducteur
  onChange: (activite: ActiviteRepos) => void
}) {
  const compte = reposActif(activite)

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <HeartPulse className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground">{t('bougerRepos')}</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIVITES_REPOS.map((cle) => (
          <button
            key={cle}
            onClick={() => onChange({ ...activite, type: activite.type === cle ? null : cle })}
            className={cn(
              'h-10 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest transition-colors',
              activite.type === cle ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {t(cle)}
          </button>
        ))}
      </div>

      {activite.type && (
        <label className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            value={activite.minutes}
            onChange={(e) => onChange({ ...activite, minutes: e.target.value })}
            aria-label={t('minutesCourt')}
            className="h-12 w-24 rounded-xl bg-secondary px-3 text-center text-base font-black tabular-nums text-foreground outline-none focus:bg-accent"
          />
          <span className="text-xs font-bold text-muted-foreground">{t('minutesCourt')}</span>
        </label>
      )}

      <p className={cn('text-xs', compte ? 'font-bold text-foreground' : 'text-muted-foreground')}>
        {compte ? t('reposActifCompte') : t('reposActifRegle', { n: MINUTES_REPOS_MINI })}
      </p>
    </section>
  )
}
