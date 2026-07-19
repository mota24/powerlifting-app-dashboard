'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { classifyLift, setE1RM, toLocalDateStr, type SetData } from '@/lib/powerlifting'
import { Trophy, Edit2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatsCards({ pasDuJour }: { pasDuJour: number | null }) {
  const [isEditing, setIsEditing] = useState(false)
  const [realPrs, setRealPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [tempPrs, setTempPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [theoPrs, setTheoPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })

  useEffect(() => {
    const saved = localStorage.getItem('mota_real_prs')
    if (saved) { setRealPrs(JSON.parse(saved)); setTempPrs(JSON.parse(saved)); }
  }, [])

  useEffect(() => {
    let cancelled = false
    const calculateTheo1RM = async () => {
      const since = new Date()
      since.setMonth(since.getMonth() - 6)
      const { data } = await supabase.from('workout_sets').select('exercise_name, tracking_data').gte('date', toLocalDateStr(since)).not('tracking_data', 'is', null)
      if (cancelled || !data) return

      const maxes = { squat: 0, bench: 0, deadlift: 0 }
      for (const row of data as { exercise_name: string | null; tracking_data: SetData[] | null }[]) {
        const category = classifyLift(row.exercise_name)
        if (!category || !row.tracking_data) continue
        for (const set of row.tracking_data) {
          const e1rm = setE1RM(set)
          if (e1rm > maxes[category]) maxes[category] = e1rm
        }
      }
      setTheoPrs({ squat: Math.round(maxes.squat), bench: Math.round(maxes.bench), deadlift: Math.round(maxes.deadlift) })
    }
    calculateTheo1RM()
    return () => { cancelled = true }
  }, [])

  const handleSaveRealPrs = () => {
    setRealPrs(tempPrs)
    localStorage.setItem('mota_real_prs', JSON.stringify(tempPrs))
    setIsEditing(false)
  }

  const totalReel = realPrs.squat + realPrs.bench + realPrs.deadlift
  const totalTheo = Math.max(realPrs.squat, theoPrs.squat) + Math.max(realPrs.bench, theoPrs.bench) + Math.max(realPrs.deadlift, theoPrs.deadlift)

  return (
    <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900/50 pb-4">
        <div className="flex items-center gap-3">
          <Trophy className="size-4 text-white" />
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">Records 1RM</h2>
        </div>
        
        {isEditing ? (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="p-2 text-zinc-500 hover:text-white rounded-lg"><X className="size-4" /></button>
            <button onClick={handleSaveRealPrs} className="p-2 text-black bg-white hover:bg-zinc-200 rounded-lg"><Check className="size-4" /></button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
            <Edit2 className="size-3" /> Modifier
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['squat', 'bench', 'deadlift'].map((lift) => (
          <div key={lift} className="p-4 bg-zinc-900 rounded-xl">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{lift}</h3>
            {isEditing ? (
              <input type="number" value={tempPrs[lift as keyof typeof tempPrs]} onChange={(e) => setTempPrs({...tempPrs, [lift]: parseInt(e.target.value) || 0})} className="w-full bg-black p-3 rounded-lg border border-zinc-800 text-white font-black tabular-nums outline-none mb-1 text-lg" />
            ) : (
              <div className="text-3xl font-black text-white tabular-nums mb-1">{realPrs[lift as keyof typeof realPrs]}</div>
            )}
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              e1RM: <span className={cn(theoPrs[lift as keyof typeof theoPrs] > realPrs[lift as keyof typeof realPrs] ? "text-white" : "text-zinc-600")}>{theoPrs[lift as keyof typeof theoPrs] > 0 ? theoPrs[lift as keyof typeof theoPrs] : '-'} kg</span>
            </div>
          </div>
        ))}
        
        <div className="p-4 bg-white rounded-xl text-black flex flex-col justify-between">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Total SBD</h3>
          <div className="text-3xl font-black tabular-nums mb-1">{totalReel}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            e1RM: <span className="text-black">{totalTheo} kg</span>
          </div>
        </div>
      </div>
    </div>
  )
}