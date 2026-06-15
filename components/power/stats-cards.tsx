'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy, Edit2, Check, X, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const LIFT_SQUAT = ['squat']
const LIFT_BENCH = ['bench press', 'paused bench', 'close grip bench', 'incline bench', 'spoto press', 'larsen press']
const LIFT_DEADLIFT = ['deadlift', 'rdl', 'block pulls']

export function StatsCards({ pasDuJour }: { pasDuJour: number | null }) {
  const [isEditing, setIsEditing] = useState(false)
  const [realPrs, setRealPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [tempPrs, setTempPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [theoPrs, setTheoPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })

  useEffect(() => {
    const saved = localStorage.getItem('mota_real_prs')
    if (saved) {
      const parsed = JSON.parse(saved)
      setRealPrs(parsed)
      setTempPrs(parsed)
    }
  }, [])

  useEffect(() => {
    const calculateTheo1RM = async () => {
      const { data } = await supabase.from('workout_sets').select('exercise_name, tracking_data')
      if (!data) return

      let maxS = 0, maxB = 0, maxD = 0

      data.forEach(row => {
        if (!row.tracking_data || !row.exercise_name) return
        const name = row.exercise_name.toLowerCase()
        const isSquat = LIFT_SQUAT.some(l => name.includes(l)) && !name.includes('split')
        const isBench = LIFT_BENCH.some(l => name.includes(l))
        const isDeadlift = LIFT_DEADLIFT.some(l => name.includes(l))

        row.tracking_data.forEach((set: any) => {
          const weight = parseFloat(set.weight)
          const reps = parseInt(set.reps)
          const rpe = parseFloat(set.rpe) || 10 
          if (weight > 0 && reps > 0) {
            const rir = 10 - rpe
            const effectiveReps = reps + rir
            let e1rm = weight
            if (effectiveReps > 1) {
              const epley = weight * (1 + (effectiveReps / 30))
              const brzycki = weight * (36 / (37 - effectiveReps))
              e1rm = (epley + brzycki) / 2
            }
            if (isSquat && e1rm > maxS) maxS = e1rm
            if (isBench && e1rm > maxB) maxB = e1rm
            if (isDeadlift && e1rm > maxD) maxD = e1rm
          }
        })
      })

      setTheoPrs({ 
        squat: Math.round(maxS), 
        bench: Math.round(maxB), 
        deadlift: Math.round(maxD) 
      })
    }
    calculateTheo1RM()
  }, [])

  const handleSaveRealPrs = () => {
    setRealPrs(tempPrs)
    localStorage.setItem('mota_real_prs', JSON.stringify(tempPrs))
    setIsEditing(false)
  }

  const totalReel = realPrs.squat + realPrs.bench + realPrs.deadlift
  const bestSquat = Math.max(realPrs.squat, theoPrs.squat)
  const bestBench = Math.max(realPrs.bench, theoPrs.bench)
  const bestDeadlift = Math.max(realPrs.deadlift, theoPrs.deadlift)
  const totalTheo = bestSquat + bestBench + bestDeadlift

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yellow-500/10 rounded-lg"><Trophy className="size-5 text-yellow-500" /></div>
          <h2 className="text-lg font-bold text-white">Records Personnels (1RM)</h2>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><X className="size-4" /></button>
            <button onClick={handleSaveRealPrs} className="p-2 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg"><Check className="size-4" /></button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors">
            <Edit2 className="size-3" /> Modifier
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* SQUAT */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Squat</h3>
          {isEditing ? (
            <input type="number" value={tempPrs.squat} onChange={(e) => setTempPrs({...tempPrs, squat: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-white font-bold outline-none" />
          ) : (
            <div className="text-2xl font-black text-white">{realPrs.squat} <span className="text-sm text-slate-500">kg</span></div>
          )}
          <div className={cn("text-xs font-bold", theoPrs.squat > realPrs.squat ? "text-emerald-400" : "text-blue-400")}>Théo: {theoPrs.squat || '-'}kg</div>
        </div>

        {/* BENCH */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Bench</h3>
          {isEditing ? (
            <input type="number" value={tempPrs.bench} onChange={(e) => setTempPrs({...tempPrs, bench: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-white font-bold outline-none" />
          ) : (
            <div className="text-2xl font-black text-white">{realPrs.bench} <span className="text-sm text-slate-500">kg</span></div>
          )}
          <div className={cn("text-xs font-bold", theoPrs.bench > realPrs.bench ? "text-emerald-400" : "text-blue-400")}>Théo: {theoPrs.bench || '-'}kg</div>
        </div>

        {/* DEADLIFT */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Deadlift</h3>
          {isEditing ? (
            <input type="number" value={tempPrs.deadlift} onChange={(e) => setTempPrs({...tempPrs, deadlift: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-white font-bold outline-none" />
          ) : (
            <div className="text-2xl font-black text-white">{realPrs.deadlift} <span className="text-sm text-slate-500">kg</span></div>
          )}
          <div className={cn("text-xs font-bold", theoPrs.deadlift > realPrs.deadlift ? "text-emerald-400" : "text-blue-400")}>Théo: {theoPrs.deadlift || '-'}kg</div>
        </div>

        {/* PAS + TOTAL */}
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Pas</h3>
            <div className="text-xl font-black text-white">{pasDuJour || 0} <span className="text-sm text-slate-500 font-medium">pas</span></div>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <h3 className="text-sm font-bold text-blue-400 uppercase mb-2">Total SBD</h3>
            <div className="text-xl font-black text-white">{totalReel} <span className="text-sm text-blue-500 font-medium">kg</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}