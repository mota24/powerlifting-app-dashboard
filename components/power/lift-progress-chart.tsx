'use client'

import { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { classifyLift, setsTonnage, setE1RM, toLocalDateStr, type LiftCategory, type SetData } from '@/lib/powerlifting'
import { cn } from '@/lib/utils'
import { RefreshCw, HeartPulse } from 'lucide-react'

// ... (Garde exactement tes interfaces ChartRow, WeekPoint, LIFTS, et la fonction mondayOf sans rien changer) ...
interface ChartRow { date: string; exercise_name: string | null; tracking_data: SetData[] | null; pain_level?: number | null; }
interface WeekPoint { semaine: string; tonnage: number; topSet: number; e1rm: number; douleur: number | null; }
const LIFTS: { key: LiftCategory; label: string; color: string }[] = [ { key: 'squat', label: 'Squat', color: '#ffffff' }, { key: 'bench', label: 'Bench', color: '#a1a1aa' }, { key: 'deadlift', label: 'Deadlift', color: '#52525b' } ]
function mondayOf(dateStr: string): string { const [y, m, d] = dateStr.split('-').map(Number); const date = new Date(y, m - 1, d); const day = date.getDay(); date.setDate(date.getDate() - day + (day === 0 ? -6 : 1)); return toLocalDateStr(date); }

export function LiftProgressChart() {
  const [rows, setRows] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lift, setLift] = useState<LiftCategory>('bench')

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 6)
      // .lte('date', aujourd'hui) : la propagation de bloc pré-remplit les 4
      // semaines à venir, mais ces séances n'ont pas encore eu lieu.
      const { data } = await supabase.from('workout_sets').select('*').gte('date', toLocalDateStr(since)).lte('date', toLocalDateStr(new Date())).order('date', { ascending: true })
      if (!cancelled) { setRows((data ?? []) as ChartRow[]); setLoading(false) }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const points: WeekPoint[] = useMemo(() => {
    const parSemaine = new Map<string, { tonnage: number; topSet: number; e1rm: number; pains: number[] }>()
    for (const row of rows) {
      if (classifyLift(row.exercise_name) !== lift) continue
      // Séance planifiée mais rien de réellement soulevé (poids vide) : on
      // ignore la semaine plutôt que de la compter comme un 0.
      const validSets = (row.tracking_data ?? []).filter((set) => parseFloat(set?.weight) > 0)
      if (validSets.length === 0) continue
      const semaine = mondayOf(row.date)
      const agg = parSemaine.get(semaine) ?? { tonnage: 0, topSet: 0, e1rm: 0, pains: [] }
      agg.tonnage += setsTonnage(row.tracking_data)
      for (const set of validSets) {
        const w = parseFloat(set.weight); if (w > agg.topSet) agg.topSet = w
        const e1rm = setE1RM(set); if (e1rm > agg.e1rm) agg.e1rm = e1rm
      }
      if (typeof row.pain_level === 'number') agg.pains.push(row.pain_level)
      parSemaine.set(semaine, agg)
    }
    return Array.from(parSemaine.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([monday, agg]) => {
      const [, m, d] = monday.split('-')
      return { semaine: `${d}/${m}`, tonnage: Math.round(agg.tonnage), topSet: agg.topSet, e1rm: Math.round(agg.e1rm), douleur: agg.pains.length ? Math.round((agg.pains.reduce((s, p) => s + p, 0) / agg.pains.length) * 10) / 10 : null }
    })
  }, [rows, lift])

  const color = LIFTS.find((l) => l.key === lift)!.color
  const showPain = (lift === 'squat' || lift === 'deadlift') && points.some((p) => p.douleur !== null)

  if (loading) return <div className="h-[350px] flex items-center justify-center text-zinc-600"><RefreshCw className="size-5 animate-spin" /></div>

  return (
    <div className="mt-6 space-y-8 p-6 sm:p-8 bg-zinc-950 border border-zinc-900 rounded-2xl">
      <div className="flex bg-zinc-900 p-1 rounded-xl w-fit">
        {LIFTS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLift(l.key)}
            className={cn(
              'px-6 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all',
              lift === l.key ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-[10px] uppercase tracking-widest font-bold text-zinc-600">
          AUCUNE DONNÉE VALIDÉE
        </div>
      ) : (
        <>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="semaine" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="tonnage" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}t`} />
                <YAxis yAxisId="topset" orientation="right" stroke="#ffffff" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 10', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#ffffff', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }} itemStyle={{ fontWeight: '900' }} formatter={(value, name) => name === 'Tonnage' ? [`${Number(value).toLocaleString('fr-FR')} kg`, name] : [`${value} kg`, name]} />
                <Bar yAxisId="tonnage" dataKey="tonnage" name="Tonnage" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                <Line yAxisId="topset" type="monotone" dataKey="topSet" name="Top set" stroke="#ffffff" strokeWidth={3} dot={{ r: 4, fill: '#ffffff', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                <Line yAxisId="topset" type="monotone" dataKey="e1rm" name="e1RM" stroke="#a1a1aa" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {showPain && (
            <div className="pt-6 border-t border-zinc-900">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <HeartPulse className="size-3 text-white" /> Douleur Moyenne
              </h3>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="semaine" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#ffffff' }} />
                    <Line type="monotone" dataKey="douleur" name="Douleur" stroke="#ffffff" strokeWidth={2} dot={{ r: 3, fill: '#ffffff', strokeWidth: 0 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}