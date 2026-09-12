'use client'

import { memo } from 'react'
import { Check, ChevronDown, ChevronUp, Trash2, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale, useT, useTheme } from '@/app/ThemeContext'
import { PAIN_LEVELS, bestE1RM, classifyLift, type SetData } from '@/lib/powerlifting'
import type { ExerciceRow } from '@/lib/seance'

interface ExerciseCardProps { ex: ExerciceRow; exIndex: number; isLast: boolean; listId: string; onPatch: (index: number, patch: Partial<ExerciceRow>) => void; onUpdateSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number, champ: keyof SetData, valeur: string) => void; onAjouterSerie: (exIndex: number, list: 'coachTracking' | 'tracking') => void; onSupprimerSerie: (exIndex: number, list: 'coachTracking' | 'tracking', setIndex: number) => void; onDeplacer: (index: number, direction: 'up' | 'down') => void; onSupprimer: (index: number, ex: ExerciceRow) => void; onCopierCoach: (exIndex: number) => void; onValiderSerie: (exIndex: number, setIndex: number) => void; suggestionPoids: number | null; suggestionAncien: number | null; onAppliquerSuggestion: (exIndex: number, poids: number, ancien: number) => void; }

export const ExerciseCard = memo(function ExerciseCard({ ex, exIndex, isLast, listId, onPatch, onUpdateSerie, onAjouterSerie, onSupprimerSerie, onDeplacer, onSupprimer, onCopierCoach, onValiderSerie, suggestionPoids, suggestionAncien, onAppliquerSuggestion }: ExerciseCardProps) {
  const { mode } = useTheme()
  const t = useT()
  const locale = useLocale()
  // Pas de RPE en mode fitness : c'est un outil d'autorégulation de
  // powerlifteur, hors sujet pour de la muscu en salle sans compétition.
  const avecRpe = mode !== 'fitness'
  const e1rmJour = classifyLift(ex.name, mode) ? bestE1RM(ex.tracking) : 0
  return (
    <div className="p-4 sm:p-6 rounded-2xl border border-border bg-card space-y-6">
      <div className="flex items-center gap-1.5 sm:gap-3 w-full max-w-full">
        <div className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-lg font-black tabular-nums">{exIndex + 1}</div>
        <input list={listId} placeholder={t('nomDuMouvement')} className="flex-1 min-w-0 p-3 bg-input border border-border rounded-xl text-foreground text-sm font-black uppercase tracking-widest outline-none focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground transition-colors truncate" value={ex.name} onChange={(e) => onPatch(exIndex, { name: e.target.value })} />

        <div className="shrink-0 flex items-center bg-secondary border border-border rounded-xl">
          <button onClick={() => onDeplacer(exIndex, 'up')} disabled={exIndex === 0} className="p-3 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors border-r border-border"><ChevronUp className="size-4" /></button>
          <button onClick={() => onDeplacer(exIndex, 'down')} disabled={isLast} className="p-3 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"><ChevronDown className="size-4" /></button>
        </div>
        <button onClick={() => onSupprimer(exIndex, ex)} className="shrink-0 p-3 text-muted-foreground hover:text-destructive bg-secondary border border-border rounded-xl transition-colors"><Trash2 className="size-4" /></button>
      </div>

      {suggestionPoids !== null && suggestionAncien !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-3 py-2">
          <TrendingUp className="size-4 shrink-0 text-foreground" />
          <p className="min-w-0 flex-1 text-xs font-bold text-foreground">{t('suggestionProgression', { ancien: suggestionAncien.toLocaleString(locale), poids: suggestionPoids.toLocaleString(locale) })}</p>
          <button onClick={() => onAppliquerSuggestion(exIndex, suggestionPoids, suggestionAncien)} className="h-9 shrink-0 rounded-lg bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90">{t('appliquer')}</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-background flex flex-col h-full">
          <h3 className="text-[10px] font-bold text-muted-foreground mb-4 uppercase tracking-widest">{t('prescription')}</h3>
          <div className={cn('grid gap-2 mb-2 px-1', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto]' : 'grid-cols-[auto_1fr_1fr_auto]')}>
            <div className="w-6"></div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('reps')}</div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('poids')}</div>{avecRpe && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('rpe')}</div>}<div className="w-9"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.coachTracking.map((set, setIndex) => (
              <div key={setIndex} className={cn('grid gap-2 items-center', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto]' : 'grid-cols-[auto_1fr_1fr_auto]')}>
                <span className="w-6 text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">S{setIndex + 1}</span>
                <input type="text" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'reps', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums" />
                <input type="text" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'weight', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums" />
                {avecRpe && <input type="text" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'coachTracking', setIndex, 'rpe', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums" />}
                <button onClick={() => onSupprimerSerie(exIndex, 'coachTracking', setIndex)} className="h-11 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => onAjouterSerie(exIndex, 'coachTracking')} className="mt-4 w-full py-3 bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">{t('ajouter')}</button>
        </div>

        <div className="p-4 rounded-xl border border-border bg-background flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-widest">{t('valide')}</h3>
            {e1rmJour > 0 && <span className="text-[10px] font-black text-foreground tabular-nums tracking-widest">E1RM: {Math.round(e1rmJour)}</span>}
          </div>
          <div className={cn('grid gap-1.5 mb-2 px-1', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto_auto]' : 'grid-cols-[auto_1fr_1fr_auto_auto]')}>
            <div className="w-5"></div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('reps')}</div><div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('poids')}</div>{avecRpe && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">{t('rpe')}</div>}<div className="w-9"></div><div className="w-9"></div>
          </div>
          <div className="space-y-2 flex-1">
            {ex.tracking.map((set, setIndex) => {
              const coach = ex.coachTracking[setIndex]; const coachRemplie = !!coach && (coach.reps !== '' || coach.weight !== ''); const serieFaite = coachRemplie && set.reps === coach.reps && set.weight === coach.weight
              return (
                <div key={setIndex} className={cn('grid gap-1.5 items-center', avecRpe ? 'grid-cols-[auto_1fr_1fr_1fr_auto_auto]' : 'grid-cols-[auto_1fr_1fr_auto_auto]')}>
                  <span className="w-5 text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">S{setIndex + 1}</span>
                  <input type="text" inputMode="decimal" enterKeyHint="next" value={set.reps} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'reps', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums focus:ring-1 focus:ring-ring" />
                  <input type="text" inputMode="decimal" enterKeyHint="next" value={set.weight} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'weight', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums focus:ring-1 focus:ring-ring" />
                  {avecRpe && <input type="text" inputMode="decimal" enterKeyHint="done" value={set.rpe} onChange={(e) => onUpdateSerie(exIndex, 'tracking', setIndex, 'rpe', e.target.value)} className="w-full p-3 bg-secondary rounded-lg text-foreground text-sm font-black text-center outline-none focus:bg-accent tabular-nums focus:ring-1 focus:ring-ring" />}
                  <button onClick={() => onValiderSerie(exIndex, setIndex)} disabled={!coachRemplie} className={cn('h-11 w-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-20', serieFaite ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground')}><Check className="size-4" /></button>
                  <button onClick={() => onSupprimerSerie(exIndex, 'tracking', setIndex)} className="h-11 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onCopierCoach(exIndex)} className="flex-1 py-3 bg-secondary hover:bg-accent text-foreground text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">{t('copierCoach')}</button>
            <button onClick={() => onAjouterSerie(exIndex, 'tracking')} className="flex-1 py-3 bg-secondary hover:bg-accent text-foreground text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors">{t('serieExtra')}</button>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('notesEtTempo')}</span>
        <input placeholder={t('exempleTempo')} value={ex.comments} onChange={(e) => onPatch(exIndex, { comments: e.target.value })} className="w-full p-4 bg-secondary border border-border rounded-xl text-xs font-bold uppercase tracking-widest text-foreground outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder:text-muted-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2 ml-1">{t('douleur')}</span>
        {PAIN_LEVELS.map((p) => (
          <button key={p.value} onClick={() => onPatch(exIndex, { painLevel: ex.painLevel === p.value ? null : p.value })} className={cn('px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors', ex.painLevel === p.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground')}>
            {p.emoji} {t(p.cle)}
          </button>
        ))}
      </div>
    </div>
  )
})
