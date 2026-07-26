'use client'

import { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { classifyLift, setsTonnage, setE1RM, toLocalDateStr, type LiftCategory, type SetData } from '@/lib/powerlifting'
import { cn } from '@/lib/utils'
import { RefreshCw, HeartPulse } from 'lucide-react'

interface ChartRow { date: string; exercise_name: string | null; tracking_data: SetData[] | null; pain_level?: number | null; }
/** `date` = jour de la séance ciblée par le clic (celle du top set en vue hebdo). */
interface Point { label: string; date: string; tonnage: number; topSet: number; e1rm: number; douleur: number | null; }
const LIFTS: { key: LiftCategory; label: string }[] = [ { key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bench' }, { key: 'deadlift', label: 'Deadlift' } ]
/** Une séance = un jour ; une semaine = volume cumulé (utile en powerlifting). */
type Granularite = 'seance' | 'semaine'
function mondayOf(dateStr: string): string { const [y, m, d] = dateStr.split('-').map(Number); const date = new Date(y, m - 1, d); const day = date.getDay(); date.setDate(date.getDate() - day + (day === 0 ? -6 : 1)); return toLocalDateStr(date); }
function jourMois(dateStr: string): string { const [, m, d] = dateStr.split('-'); return `${d}/${m}` }

export function LiftProgressChart({ onSelectSession }: { onSelectSession?: (date: string) => void }) {
  const [rows, setRows] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lift, setLift] = useState<LiftCategory>('bench')
  const [granularite, setGranularite] = useState<Granularite>('seance')

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 6)
      // .lte('date', aujourd'hui) : la propagation de bloc pré-remplit les 4
      // semaines à venir, mais ces séances n'ont pas encore eu lieu.
      const { data } = await supabase.from('workout_sets').select('date, exercise_name, tracking_data, pain_level').gte('date', toLocalDateStr(since)).lte('date', toLocalDateStr(new Date())).order('date', { ascending: true })
      if (!cancelled) { setRows((data ?? []) as ChartRow[]); setLoading(false) }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const points: Point[] = useMemo(() => {
    // Une entrée par séance (ou par semaine) : plusieurs lignes workout_sets
    // du même jour (ex. « Bench Press » + « Bench machine ») fusionnent.
    const groupes = new Map<string, { date: string; tonnage: number; topSet: number; e1rm: number; pains: number[] }>()
    for (const row of rows) {
      if (classifyLift(row.exercise_name) !== lift) continue
      // Séance planifiée mais rien de réellement soulevé (colonne « réalisé »
      // vide) : on l'ignore plutôt que de la compter comme un 0.
      const validSets = (row.tracking_data ?? []).filter((set) => parseFloat(set?.weight) > 0)
      if (validSets.length === 0) continue
      const cle = granularite === 'semaine' ? mondayOf(row.date) : row.date
      const agg = groupes.get(cle) ?? { date: row.date, tonnage: 0, topSet: 0, e1rm: 0, pains: [] }
      agg.tonnage += setsTonnage(row.tracking_data)
      for (const set of validSets) {
        const w = parseFloat(set.weight)
        // On retient le jour du top set : c'est la séance ouverte au clic.
        if (w > agg.topSet) { agg.topSet = w; agg.date = row.date }
        const e1rm = setE1RM(set); if (e1rm > agg.e1rm) agg.e1rm = e1rm
      }
      if (typeof row.pain_level === 'number') agg.pains.push(row.pain_level)
      groupes.set(cle, agg)
    }
    return Array.from(groupes.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([cle, agg]) => ({
      // En vue hebdo le libellé est préfixé : « sem. 20/07 » ne peut pas se
      // lire comme la date d'une séance (le lundi n'en est souvent pas une).
      label: granularite === 'semaine' ? `sem. ${jourMois(cle)}` : jourMois(cle),
      date: agg.date,
      tonnage: Math.round(agg.tonnage),
      topSet: agg.topSet,
      e1rm: Math.round(agg.e1rm),
      douleur: agg.pains.length ? Math.round((agg.pains.reduce((s, p) => s + p, 0) / agg.pains.length) * 10) / 10 : null,
    }))
  }, [rows, lift, granularite])

  // Recharts expose l'index de la catégorie survolée : plus robuste que de
  // fouiller la forme du payload, et couvre le clic n'importe où sur la colonne.
  const handleChartClick = (state: { activeTooltipIndex?: number | string | null }) => {
    if (!onSelectSession) return
    const raw = state?.activeTooltipIndex
    if (raw == null) return
    const index = typeof raw === 'number' ? raw : Number.parseInt(raw, 10)
    if (!Number.isInteger(index) || index < 0) return
    const point = points[index]
    if (point) onSelectSession(point.date)
  }

  const showPain = (lift === 'squat' || lift === 'deadlift') && points.some((p) => p.douleur !== null)

  if (loading) return <div className="h-[350px] flex items-center justify-center text-zinc-600"><RefreshCw className="size-5 animate-spin" /></div>

  return (
    <div className="mt-6 space-y-8 p-6 sm:p-8 bg-zinc-950 border border-zinc-900 rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="flex bg-zinc-900 p-1 rounded-xl w-fit">
          {([
            { key: 'seance', label: 'Par séance' },
            { key: 'semaine', label: 'Par semaine' },
          ] as const).map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularite(g.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all',
                granularite === g.key ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-white'
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-[10px] uppercase tracking-widest font-bold text-zinc-600">
          AUCUNE DONNÉE VALIDÉE
        </div>
      ) : (
        <>
          <div className={cn('h-[300px] w-full', onSelectSession && 'cursor-pointer')}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 0, left: -10, bottom: 0 }} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                {/* Une décimale : sur une seule séance, arrondir au millier
                    affichait « 2t » deux fois de suite sur l'axe. */}
                <YAxis yAxisId="tonnage" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}t`} />
                <YAxis yAxisId="topset" orientation="right" stroke="#ffffff" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 10', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#ffffff', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }} itemStyle={{ fontWeight: '900' }} formatter={(value, name) => name === 'Tonnage' ? [`${Number(value).toLocaleString('fr-FR')} kg`, name] : [`${value} kg`, name]} />
                <Bar yAxisId="tonnage" dataKey="tonnage" name="Tonnage" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                <Line yAxisId="topset" type="monotone" dataKey="topSet" name="Top set" stroke="#ffffff" strokeWidth={3} dot={{ r: 4, fill: '#ffffff', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                <Line yAxisId="topset" type="monotone" dataKey="e1rm" name="e1RM" stroke="#a1a1aa" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {onSelectSession && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
              {granularite === 'seance'
                ? `${points.length} séance${points.length > 1 ? 's' : ''} — clique sur un point pour l'ouvrir`
                : 'Clique sur un point pour ouvrir la séance du top set de la semaine'}
            </p>
          )}

          {showPain && (
            <div className="pt-6 border-t border-zinc-900">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <HeartPulse className="size-3 text-white" /> Douleur Moyenne
              </h3>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="label" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
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