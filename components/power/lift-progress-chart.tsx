'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, LineChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import {
  classifyLift, setsTonnage, toLocalDateStr,
  type LiftCategory, type SetData,
} from '@/lib/powerlifting'
import { cn } from '@/lib/utils'
import { RefreshCw, HeartPulse } from 'lucide-react'

interface ChartRow {
  date: string;
  exercise_name: string | null;
  tracking_data: SetData[] | null;
  pain_level?: number | null;
}

interface WeekPoint {
  semaine: string;      // libellé "23/06"
  tonnage: number;      // kg soulevés (athlète) sur la semaine
  topSet: number;       // charge max manipulée
  douleur: number | null; // douleur moyenne 0-3 (si renseignée)
}

const LIFTS: { key: LiftCategory; label: string; color: string }[] = [
  { key: 'squat', label: 'Squat', color: '#ef4444' },
  { key: 'bench', label: 'Bench', color: '#3b82f6' },
  { key: 'deadlift', label: 'Deadlift', color: '#10b981' },
]

/** Lundi de la semaine d'une date YYYY-MM-DD (heure locale) */
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return toLocalDateStr(date)
}

export function LiftProgressChart() {
  const [rows, setRows] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lift, setLift] = useState<LiftCategory>('bench')

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      // 6 derniers mois suffisent pour piloter un cycle — évite le full scan
      const since = new Date()
      since.setMonth(since.getMonth() - 6)
      const { data } = await supabase
        .from('workout_sets')
        .select('*')
        .gte('date', toLocalDateStr(since))
        .order('date', { ascending: true })
      if (!cancelled) {
        setRows((data ?? []) as ChartRow[])
        setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const points: WeekPoint[] = useMemo(() => {
    const parSemaine = new Map<string, { tonnage: number; topSet: number; pains: number[] }>()

    for (const row of rows) {
      if (classifyLift(row.exercise_name) !== lift) continue
      const semaine = mondayOf(row.date)
      const agg = parSemaine.get(semaine) ?? { tonnage: 0, topSet: 0, pains: [] }

      agg.tonnage += setsTonnage(row.tracking_data)
      for (const set of row.tracking_data ?? []) {
        const w = parseFloat(set?.weight)
        if (w > agg.topSet) agg.topSet = w
      }
      if (typeof row.pain_level === 'number') agg.pains.push(row.pain_level)

      parSemaine.set(semaine, agg)
    }

    return Array.from(parSemaine.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([monday, agg]) => {
        const [, m, d] = monday.split('-')
        return {
          semaine: `${d}/${m}`,
          tonnage: Math.round(agg.tonnage),
          topSet: agg.topSet,
          douleur: agg.pains.length
            ? Math.round((agg.pains.reduce((s, p) => s + p, 0) / agg.pains.length) * 10) / 10
            : null,
        }
      })
  }, [rows, lift])

  const color = LIFTS.find((l) => l.key === lift)!.color
  const showPain = (lift === 'squat' || lift === 'deadlift') && points.some((p) => p.douleur !== null)

  if (loading) {
    return (
      <div className="h-[350px] flex items-center justify-center text-slate-500">
        <RefreshCw className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Sélecteur de lift */}
      <div className="flex gap-2">
        {LIFTS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLift(l.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-bold border transition-colors',
              lift === l.key
                ? 'border-blue-500 bg-blue-500/10 text-white'
                : 'border-border text-muted-foreground hover:bg-secondary'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">
          Aucune donnée validée sur ce mouvement pour l'instant. Remplis tes séances !
        </div>
      ) : (
        <>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="semaine" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="tonnage" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}t`} />
                <YAxis yAxisId="topset" orientation="right" stroke={color} fontSize={11} tickLine={false} axisLine={false}
                  domain={['dataMin - 10', 'auto']} unit=" kg" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  formatter={(value, name) =>
                    name === 'Tonnage' ? [`${Number(value).toLocaleString('fr-FR')} kg`, name] : [`${value} kg`, name]}
                />
                <Bar yAxisId="tonnage" dataKey="tonnage" name="Tonnage" fill={color} fillOpacity={0.25} radius={[4, 4, 0, 0]} />
                <Line yAxisId="topset" type="monotone" dataKey="topSet" name="Top set" stroke={color} strokeWidth={3}
                  dot={{ r: 4, fill: color, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: 0.4 }} /> Tonnage hebdo (barres)</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> Top set (ligne)</span>
          </div>

          {/* Courbe de désensibilisation : douleur moyenne par semaine (rééducation) */}
          {showPain && (
            <div className="pt-2 border-t border-slate-800">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                <HeartPulse className="size-3.5 text-rose-400" /> Douleur moyenne / semaine (0 = OK · 3 = Stop)
              </h3>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="semaine" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }} />
                    <Line type="monotone" dataKey="douleur" name="Douleur" stroke="#fb7185" strokeWidth={2}
                      dot={{ r: 3, fill: '#fb7185', strokeWidth: 0 }} connectNulls />
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
