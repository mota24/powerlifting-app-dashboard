'use client'

import { useState } from 'react'
import { Edit2, Check, TrendingUp } from 'lucide-react'

export function StatsCards() {
  const [isEditing, setIsEditing] = useState(false)

  // Vrais PR (Réels) - Initialisés avec tes charges
  const [realSquat, setRealSquat] = useState(300)
  const [realBench, setRealBench] = useState(175)
  const [realDeadlift, setRealDeadlift] = useState(340)

  // PR Théoriques (Simulés pour l'exemple, calculés par l'appli normalement)
  const theoSquat = 305
  const theoBench = 178
  const theoDeadlift = 345

  const totalReal = realSquat + realBench + realDeadlift
  const totalTheo = theoSquat + theoBench + theoDeadlift

  return (
    <div className="space-y-4">
      {/* En-tête avec le bouton de modification */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-200">Records Personnels (1RM)</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition-colors border border-slate-700"
        >
          {isEditing ? <Check className="size-4 text-emerald-500" /> : <Edit2 className="size-4 text-blue-500" />}
          {isEditing ? "Valider les PR" : "Modifier mes PR"}
        </button>
      </div>

      {/* Les 4 Cartes SBD */}
      <div className="grid gap-4 md:grid-cols-4">
        
        {/* SQUAT */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-400 mb-2">Squat</div>
          {isEditing ? (
            <input
              type="number"
              value={realSquat}
              onChange={(e) => setRealSquat(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-2xl font-bold text-white mb-2 outline-none focus:border-blue-500"
            />
          ) : (
            <div className="text-2xl font-bold text-white mb-2">
              {realSquat} kg <span className="text-xs font-normal text-slate-500 ml-1">Réel</span>
            </div>
          )}
          <div className="text-xs text-blue-400 flex items-center gap-1 bg-blue-500/10 w-fit px-2 py-1 rounded-md">
            <TrendingUp className="size-3" /> Théorique: {theoSquat} kg
          </div>
        </div>

        {/* BENCH */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-400 mb-2">Bench Press</div>
          {isEditing ? (
            <input
              type="number"
              value={realBench}
              onChange={(e) => setRealBench(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-2xl font-bold text-white mb-2 outline-none focus:border-blue-500"
            />
          ) : (
            <div className="text-2xl font-bold text-white mb-2">
              {realBench} kg <span className="text-xs font-normal text-slate-500 ml-1">Réel</span>
            </div>
          )}
          <div className="text-xs text-blue-400 flex items-center gap-1 bg-blue-500/10 w-fit px-2 py-1 rounded-md">
            <TrendingUp className="size-3" /> Théorique: {theoBench} kg
          </div>
        </div>

        {/* DEADLIFT */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-400 mb-2">Deadlift</div>
          {isEditing ? (
            <input
              type="number"
              value={realDeadlift}
              onChange={(e) => setRealDeadlift(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-2xl font-bold text-white mb-2 outline-none focus:border-blue-500"
            />
          ) : (
            <div className="text-2xl font-bold text-white mb-2">
              {realDeadlift} kg <span className="text-xs font-normal text-slate-500 ml-1">Réel</span>
            </div>
          )}
          <div className="text-xs text-blue-400 flex items-center gap-1 bg-blue-500/10 w-fit px-2 py-1 rounded-md">
            <TrendingUp className="size-3" /> Théorique: {theoDeadlift} kg
          </div>
        </div>

        {/* TOTAL SBD */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-sm relative overflow-hidden">
          <div className="text-sm font-medium text-blue-400 mb-2">Total SBD</div>
          <div className="text-2xl font-bold text-blue-500 mb-2">{totalReal} kg</div>
          <div className="text-xs text-blue-400/80">Théorique: {totalTheo} kg</div>
        </div>

      </div>
    </div>
  )
}