'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { painLabel, LIFT_SQUAT, LIFT_BENCH, LIFT_DEADLIFT, ACCESSORIES, type SetData } from '@/lib/powerlifting'
import { History, Search, RefreshCw, MessageSquare } from 'lucide-react'

// ... (Mêmes constantes et interfaces que ton code actuel) ...
const TOUS_LES_EXERCICES = [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
const REST_NAMES = ['Repos', 'Jour de Repos']
interface HistoryRow { id: string; date: string; exercise_name: string | null; tracking_data: SetData[] | null; pain_level?: number | null; comments: string | null; }
interface HistoryEntry { id: string; date: string; exercice: string; sets: string; douleur: string | null; comments: string | null; }
function formatDate(d: string): string { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit', }) }

export default function HistoryPanel() {
  const [recherche, setRecherche] = useState('')
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [aCherche, setACherche] = useState(false)

  useEffect(() => {
    const terme = recherche.trim()
    if (terme.length < 3) { setEntries([]); setACherche(false); return }
    let cancelled = false; setLoading(true)
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from('workout_sets').select('id, date, exercise_name, tracking_data, pain_level, comments').ilike('exercise_name', `%${terme}%`).order('date', { ascending: false }).limit(100)
      if (cancelled) return
      if (error) { setEntries([]) } else {
        const result: HistoryEntry[] = []
        for (const row of (data ?? []) as HistoryRow[]) {
          if (!row.exercise_name || REST_NAMES.includes(row.exercise_name)) continue
          const sets = (row.tracking_data ?? []).filter((s) => s.reps?.trim() && s.weight?.trim()).map((s) => `${s.reps}×${s.weight} kg${s.rpe?.trim() ? ` @${s.rpe}` : ''}`).join(' · ')
          if (!sets) continue
          result.push({ id: row.id, date: row.date, exercice: row.exercise_name, sets, douleur: painLabel(row.pain_level), comments: row.comments })
        }
        setEntries(result)
      }
      setACherche(true); setLoading(false)
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [recherche])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <History className="size-5 text-white" />
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">Historique</h2>
      </div>

      <div className="flex items-center gap-3 bg-zinc-900 px-4 py-4 rounded-xl border border-zinc-800 focus-within:border-white transition-colors">
        <Search className="size-4 text-zinc-500 shrink-0" />
        <input type="text" list="historique-exercices" placeholder="RECHERCHE (EX: BENCH PRESS)" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="w-full bg-transparent text-white text-xs font-bold uppercase tracking-widest outline-none placeholder:text-zinc-600" autoFocus />
        {loading && <RefreshCw className="size-4 text-white animate-spin shrink-0" />}
      </div>
      <datalist id="historique-exercices">{TOUS_LES_EXERCICES.map((nom) => <option key={nom} value={nom} />)}</datalist>

      {recherche.trim().length < 3 ? (
        <div className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 border border-zinc-900 rounded-2xl">
          TAPE 3 LETTRES POUR CHERCHER
        </div>
      ) : !loading && aCherche && entries.length === 0 ? (
        <div className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 border border-zinc-900 rounded-2xl">
          AUCUN RÉSULTAT POUR « {recherche.trim()} »
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">{formatDate(e.date)}</span>
                  <span className="text-sm font-black text-white uppercase truncate">{e.exercice}</span>
                </div>
                {e.douleur && <span className="text-[10px] font-bold uppercase tracking-widest text-white px-2 py-1 bg-zinc-900 rounded-md">{e.douleur}</span>}
              </div>
              <div className="font-mono text-sm font-black text-white tabular-nums">{e.sets}</div>
              {e.comments && <div className="flex items-center gap-2 text-xs font-medium text-zinc-500"><MessageSquare className="size-3 shrink-0" /> {e.comments}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}