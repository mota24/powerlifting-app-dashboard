'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { painLabel, type SetData } from '@/lib/powerlifting'
import { History } from 'lucide-react'

interface HistoryEntry {
  date: string;
  sets: string;      // "5×100@7 · 5×105@8"
  douleur: string | null;
}

interface HistoryRow {
  date: string;
  tracking_data: SetData[] | null;
  pain_level?: number | null;
}

/**
 * Affiche les 3 dernières performances validées sur un exercice,
 * pour savoir quoi charger sans quitter le formulaire.
 */
export function ExerciseHistory({ name, beforeDate }: { name: string; beforeDate: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    const cleanName = name.trim()
    if (cleanName.length < 3) {
      setEntries([])
      return
    }

    let cancelled = false
    // Debounce : on attend la fin de la frappe avant d'interroger la base
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('workout_sets')
        .select('date, tracking_data, pain_level')
        .eq('exercise_name', cleanName)
        .lt('date', beforeDate)
        .order('date', { ascending: false })
        .limit(8)

      if (cancelled) return

      const result: HistoryEntry[] = []
      for (const row of (data ?? []) as HistoryRow[]) {
        const sets = (row.tracking_data ?? [])
          .filter((s) => s.reps?.trim() && s.weight?.trim())
          .map((s) => `${s.reps}×${s.weight}${s.rpe?.trim() ? `@${s.rpe}` : ''}`)
          .join(' · ')
        if (!sets) continue // séance propagée jamais remplie : on l'ignore
        result.push({ date: row.date, sets, douleur: painLabel(row.pain_level) })
        if (result.length === 3) break
      }
      setEntries(result)
    }, 600)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [name, beforeDate])

  if (entries.length === 0) return null

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2 space-y-1 animate-in fade-in">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <History className="size-3" /> Dernières perfs — reps×kg@RPE
      </span>
      {entries.map((e) => (
        <div key={e.date} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 capitalize whitespace-nowrap">{formatDate(e.date)}</span>
          <span className="text-slate-300 font-mono font-medium truncate">{e.sets}</span>
          {e.douleur && <span className="whitespace-nowrap" title={`Douleur : ${e.douleur}`}>{e.douleur.split(' ')[0]}</span>}
        </div>
      ))}
    </div>
  )
}
