'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ConfigPanel() {
  const [dates, setDates] = useState<string[]>(['', '', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchBlocks = async () => {
      const { data } = await supabase
        .from('training_blocks')
        .select('*')
        .order('block_number', { ascending: true })

      if (data && data.length > 0) {
        const newDates = ['', '', '', '', '']
        data.forEach(b => {
          if (b.block_number >= 1 && b.block_number <= 5) {
            newDates[b.block_number - 1] = b.start_date
          }
        })
        setDates(newDates)
      }
    }
    fetchBlocks()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const promises = dates.map((date, index) => {
      if (!date) return null
      // upsert met à jour la ligne si le block_number existe déjà, sinon il la crée
      return supabase
        .from('training_blocks')
        .upsert({ block_number: index + 1, start_date: date }, { onConflict: 'block_number' })
    }).filter(Boolean)

    await Promise.all(promises)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg"><Calendar className="size-5 text-blue-400" /></div>
        <h2 className="text-lg text-white font-bold">Configuration des Blocs</h2>
      </div>
      
      <p className="text-sm text-slate-400 mb-6">
        Sélectionne la date de départ (Semaine 1) de chaque bloc. Le calcul des semaines 1 à 5 (Max) se fera automatiquement.
      </p>

      <div className="space-y-4">
        {dates.map((date, index) => (
          <div key={index} className="flex items-center gap-4">
            <label className="text-slate-300 font-bold w-16">Bloc {index + 1}</label>
            <input
              type="date"
              className="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-800 text-white outline-none focus:border-blue-500 transition-colors"
              value={date}
              onChange={(e) => {
                const newDates = [...dates]
                newDates[index] = e.target.value
                setDates(newDates)
              }}
            />
          </div>
        ))}
      </div>

      <button 
        onClick={handleSave} 
        disabled={saving} 
        className={cn(
          "w-full mt-8 p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
          saved ? "bg-emerald-600 shadow-emerald-500/25 text-white" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 text-white"
        )}
      >
        {saving ? 'Sauvegarde...' : saved ? <><Check className="size-5"/> Dates mémorisées !</> : <><Save className="size-5"/> Enregistrer la planification</>}
      </button>
    </div>
  )
}