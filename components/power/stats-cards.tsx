'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Edit2, Check, X, Flame } from 'lucide-react'
import { cn } from '../../lib/utils'

// Mots-clés pour catégoriser tes exercices
const LIFT_SQUAT = ['squat']
const LIFT_BENCH = ['bench press', 'paused bench', 'close grip bench', 'incline bench', 'spoto press', 'larsen press']
const LIFT_DEADLIFT = ['deadlift', 'rdl', 'block pulls']

export function StatsCards() {
  const [isEditing, setIsEditing] = useState(false)
  
  // PR Réels (Mémorisés localement sur ton navigateur pour l'instant)
  const [realPrs, setRealPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  const [tempPrs, setTempPrs] = useState({ squat: 300, bench: 175, deadlift: 340 })
  
  // PR Théoriques (Calculés depuis Supabase)
  const [theoPrs, setTheoPrs] = useState({ squat: 0, bench: 0, deadlift: 0 })

  // Chargement des PR réels sauvegardés
  useEffect(() => {
    const saved = localStorage.getItem('mota_real_prs')
    if (saved) {
      setRealPrs(JSON.parse(saved))
      setTempPrs(JSON.parse(saved))
    }
  }, [])

  // Calcul Automatique des 1RM Théoriques depuis la base de données
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
            // L'application calcule ton potentiel réel (Reps faites + Reps en réserve)
            const rir = 10 - rpe
            const effectiveReps = reps + rir
            
            let e1rm = 0

            // LES FORMULES EXACTES DE TON SITE WORKOUT TEMPLE :
            if (isSquat) {
              e1rm = weight * (1 + (effectiveReps * 0.03372)) // Le coef extrait de ton tableau
            } else if (isBench) {
              e1rm = weight * (1 + (effectiveReps * 0.0250))
            } else if (isDeadlift) {
              e1rm = weight * (1 + (effectiveReps * 0.042))
            }

            if (isSquat && e1rm > maxS) maxS = e1rm
            if (isBench && e1rm > maxB) maxB = e1rm
            if (isDeadlift && e1rm > maxD) maxD = e1rm
          }
        })
      })

      setTheoPrs({ squat: Math.round(maxS), bench: Math.round(maxB), deadlift: Math.round(maxD) })
    }

    calculateTheo1RM()
  }, [])

  const handleSaveRealPrs = () => {
    setRealPrs(tempPrs)
    localStorage.setItem('mota_real_prs', JSON.stringify(tempPrs))
    setIsEditing(false)
  }

  // Totaux
  const totalReel = realPrs.squat + realPrs.bench + realPrs.deadlift
  
  // Pour le total théorique, on prend le meilleur entre le Réel et le Théorique pour chaque lift
  const bestSquat = Math.max(realPrs.squat, theoPrs.squat)
  const bestBench = Math.max(realPrs.bench, theoPrs.bench)
  const bestDeadlift = Math.max(realPrs.deadlift, theoPrs.deadlift)
  const totalTheo = bestSquat + bestBench + bestDeadlift

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
      {/* En-tête : Titre et Bouton Modifier */}
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

      {/* Grille des 4 Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* SQUAT */}
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

        {/* BENCH */}
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

        {/* DEADLIFT */}
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

        {/* TOTAL SBD */}
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