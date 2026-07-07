'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  painLabel, LIFT_SQUAT, LIFT_BENCH, LIFT_DEADLIFT, ACCESSORIES,
  type SetData,
} from '@/lib/powerlifting'
import { History, Search, RefreshCw, MessageSquare } from 'lucide-react'

const TOUS_LES_EXERCICES = [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
const REST_NAMES = ['Repos', 'Jour de Repos']

interface HistoryRow {
  id: string;
  date: string;
  exercise_name: string | null;
  tracking_data: SetData[] | null;
  pain_level?: number | null;
  comments: string | null;
}

interface HistoryEntry {
  id: string;
  date: string;
  exercice: string;
  sets: string;          // "5×100 @8 · 5×105 @8.5"
  douleur: string | null;
  comments: string | null;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('fr-FR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

export default function HistoryPanel() {
  const [recherche, setRecherche] = useState('')
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [aCherche, setACherche] = useState(false)

  useEffect(() => {
    const terme = recherche.trim()
    if (terme.length < 3) {
      setEntries([])
      setACherche(false)
      return
    }

    let cancelled = false
    setLoading(true)

    // Debounce : on attend la fin de la frappe avant d'interroger la base
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('id, date, exercise_name, tracking_data, pain_level, comments')
        .ilike('exercise_name', `%${terme}%`)
        .order('date', { ascending: false })
        .limit(100)

      if (cancelled) return

      if (error) {
        console.error('Erreur historique :', error)
        setEntries([])
      } else {
        const result: HistoryEntry[] = []
        for (const row of (data ?? []) as HistoryRow[]) {
          if (!row.exercise_name || REST_NAMES.includes(row.exercise_name)) continue
          const sets = (row.tracking_data ?? [])
            .filter((s) => s.reps?.trim() && s.weight?.trim())
            .map((s) => `${s.reps}×${s.weight} kg${s.rpe?.trim() ? ` @${s.rpe}` : ''}`)
            .join(' · ')
          if (!sets) continue // séance propagée jamais remplie : sans intérêt
          result.push({
            id: row.id,
            date: row.date,
            exercice: row.exercise_name,
            sets,
            douleur: painLabel(row.pain_level),
            comments: row.comments,
          })
        }
        setEntries(result)
      }
      setACherche(true)
      setLoading(false)
    }, 500)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [recherche])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <History className="size-5 text-blue-500" /> Historique des Mouvements
        </h2>
      </div>

      {/* Barre de recherche avec auto-complétion */}
      <div className="flex items-center gap-3 bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 focus-within:border-blue-500 transition-colors">
        <Search className="size-5 text-slate-500 flex-shrink-0" />
        <input
          type="text"
          list="historique-exercices"
          placeholder="Cherche un mouvement... (ex: Bench Press, squat, deadlift)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full bg-transparent text-white outline-none placeholder:text-slate-600 font-medium"
          autoFocus
        />
        {loading && <RefreshCw className="size-4 text-blue-500 animate-spin flex-shrink-0" />}
      </div>
      <datalist id="historique-exercices">
        {TOUS_LES_EXERCICES.map((nom) => <option key={nom} value={nom} />)}
      </datalist>

      {/* Résultats */}
      {recherche.trim().length < 3 ? (
        <div className="p-10 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl">
          Tape au moins 3 lettres pour explorer ton historique complet.<br />
          La recherche est partielle : « bench » trouve Bench Press, Paused Bench, Larsen Press…
        </div>
      ) : !loading && aCherche && entries.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl">
          Aucune performance validée trouvée pour « {recherche.trim()} ».
        </div>
      ) : (
        <div className="space-y-2">
          {entries.length > 0 && (
            <p className="text-xs text-slate-500 px-1">
              {entries.length} séance{entries.length > 1 ? 's' : ''} — du plus récent au plus ancien · reps×kg @RPE
            </p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-slate-500 capitalize whitespace-nowrap bg-slate-950 border border-slate-800 rounded-md px-2 py-1">
                    {formatDate(e.date)}
                  </span>
                  <span className="text-sm font-bold text-white truncate">{e.exercice}</span>
                </div>
                {e.douleur && (
                  <span className="text-xs font-bold whitespace-nowrap" title={`Douleur : ${e.douleur}`}>
                    {e.douleur}
                  </span>
                )}
              </div>
              <div className="font-mono text-sm text-blue-200">{e.sets}</div>
              {e.comments && (
                <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                  <MessageSquare className="size-3 flex-shrink-0" /> {e.comments}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
