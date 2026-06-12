'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function ConfigPanel() {
  const [dates, setDates] = useState<string[]>(['', '', '', '', ''])

  const saveConfig = async () => {
    // Logique pour envoyer tes 5 dates à Supabase
    // Tu enregistres chaque bloc avec sa date de début
  }

  return (
    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
      <h2 className="text-white font-bold mb-4">Configuration des Blocs</h2>
      {dates.map((d, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <label className="text-slate-400 text-sm w-20">Bloc {i + 1}</label>
          <input type="date" className="bg-slate-950 p-2 rounded border border-slate-800 text-white" 
                 onChange={(e) => {
                   const newDates = [...dates];
                   newDates[i] = e.target.value;
                   setDates(newDates);
                 }} />
        </div>
      ))}
      <button onClick={saveConfig} className="w-full bg-blue-600 text-white py-2 rounded-lg mt-2">Sauvegarder</button>
    </div>
  )
}