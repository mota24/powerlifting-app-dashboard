'use client'

import { useState } from 'react'
import { Calculator, Scale, Hash } from 'lucide-react'

export default function CalculatorPanel() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  // Calcul exclusif de la moyenne Epley & Brzycki
  const calculateAverage1RM = () => {
    const w = parseFloat(weight)
    const r = parseInt(reps)

    if (!w || !r || w <= 0 || r <= 0) return 0
    if (r === 1) return w // 1 rep max est égal au poids soulevé

    const epley = w * (1 + r / 30)
    const brzycki = w * (36 / (37 - r))
    
    return Math.round((epley + brzycki) / 2)
  }

  const result1RM = calculateAverage1RM()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Calculator className="size-5 text-blue-500" /> Calculateur de 1RM Épuré
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulaire d'entrée */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="size-3.5 text-blue-500" /> Poids déplacé (kg)
            </label>
            <input
              type="number"
              placeholder="Ex: 220"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 placeholder:text-slate-700"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Hash className="size-3.5 text-blue-500" /> Nombre de répétitions
            </label>
            <input
              type="number"
              placeholder="Ex: 5"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 placeholder:text-slate-700"
            />
          </div>
        </div>

        {/* Affichage Unique du Résultat (Uniquement la Moyenne) */}
        <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[160px]">
          <div className="absolute -right-6 -bottom-6 opacity-5">
            <Calculator className="size-40 text-blue-500" />
          </div>

          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 relative z-10">
            Votre 1RM Estimé (Moyenne)
          </span>
          
          <div className="text-5xl font-black text-white relative z-10 tracking-tight">
            {result1RM > 0 ? `${result1RM}` : '—'}{' '}
            <span className="text-xl font-medium text-slate-500">kg</span>
          </div>

          <p className="text-xs text-slate-500 mt-3 max-w-[240px] relative z-10">
            Basé sur l'indice combiné d'Epley et de Brzycki pour une précision accrue.
          </p>
        </div>
      </div>
    </div>
  )
}