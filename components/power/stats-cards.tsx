'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { classifyLift, setE1RM, toLocalDateStr, type SetData } from '@/lib/powerlifting'
import { Trophy, Edit2, Check, X, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatsCards({ pasDuJour }: { pasDuJour: number | null }) {
  const [isEditing, setIsEditing] = useState(false)
  
  const [realPrs, setRealPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [tempPrs, setTempPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [theoPrs, setTheoPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })

  useEffect(() => {
    const saved = localStorage.getItem('mota_real_prs')
    if (saved) {
      setRealPrs(JSON.parse(saved))
      setTempPrs(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const calculateTheo1RM = async () => {
      // Fenêtre de 6 mois : suffisant pour un 1RM théorique récent, évite le scan complet de la table
      const since = new Date()
      since.setMonth(since.getMonth() - 6)

      const { data } = await supabase
        .from('workout_sets')
        .select('exercise_name, tracking_data')
        .gte('date', toLocalDateStr(since))
        .not('tracking_data', 'is', null)

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

      setTheoPrs({
        squat: Math.round(maxes.squat),
        bench: Math.round(maxes.bench),
        deadlift: Math.round(maxes.deadlift),
      })
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
            <Edit2 className="size-3" /> Modifier mes PR
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Squat</h3>
          {isEditing ? (
            <input type="number" value={tempPrs.squat} onChange={(e) => setTempPrs({...tempPrs, squat: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-white font-bold outline-none mb-1" />
          ) : (
            <div className="text-2xl font-black text-white mb-1">{realPrs.squat} <span className="text-sm font-medium text-slate-500">kg Réel</span></div>
          )}
          <div className={cn("text-xs font-bold", theoPrs.squat > realPrs.squat ? "text-emerald-400" : "text-blue-400")}>
            Théorique: {theoPrs.squat > 0 ? theoPrs.squat : '-'} kg
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Bench Press</h3>
          {isEditing ? (
            <input type="number" value={tempPrs.bench} onChange={(e) => setTempPrs({...tempPrs, bench: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-white font-bold outline-none mb-1" />
          ) : (
            <div className="text-2xl font-black text-white mb-1">{realPrs.bench} <span className="text-sm font-medium text-slate-500">kg Réel</span></div>
          )}
          <div className={cn("text-xs font-bold", theoPrs.bench > realPrs.bench ? "text-emerald-400" : "text-blue-400")}>
            Théorique: {theoPrs.bench > 0 ? theoPrs.bench : '-'} kg
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Deadlift</h3>
          {isEditing ? (
            <input type="number" value={tempPrs.deadlift} onChange={(e) => setTempPrs({...tempPrs, deadlift: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-white font-bold outline-none mb-1" />
          ) : (
            <div className="text-2xl font-black text-white mb-1">{realPrs.deadlift} <span className="text-sm font-medium text-slate-500">kg Réel</span></div>
          )}
          <div className={cn("text-xs font-bold", theoPrs.deadlift > realPrs.deadlift ? "text-emerald-400" : "text-blue-400")}>
            Théorique: {theoPrs.deadlift > 0 ? theoPrs.deadlift : '-'} kg
          </div>
        </div>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Pas</h3>
  <div className="text-2xl font-black text-white mb-1">
    {pasDuJour !== null ? pasDuJour : 0} 
    <span className="text-sm font-medium text-slate-500"> pas</span>
  </div>
  <div className="text-xs font-bold text-slate-500">
    Aujourd'hui
  </div>
</div>
        <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><Flame className="size-24 text-blue-500" /></div>
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2 relative z-10">Total SBD</h3>
          <div className="text-2xl font-black text-white mb-1 relative z-10">{totalReel} <span className="text-sm font-medium text-blue-500/50">kg</span></div>
          <div className="text-xs font-bold text-blue-400 relative z-10">
            Théorique: {totalTheo} kg
          </div>
        </div>

      </div>
    </div>
  )
}