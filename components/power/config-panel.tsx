'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockData {
  date: string;
  duration: number;
}

export default function ConfigPanel() {
  const [blocks, setBlocks] = useState<BlockData[]>([
    { date: '', duration: 5 }, { date: '', duration: 5 }, { date: '', duration: 5 }, { date: '', duration: 5 }, { date: '', duration: 5 }
  ])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchBlocks = async () => {
      const { data } = await supabase.from('training_blocks').select('*').order('block_number', { ascending: true })
      if (data && data.length > 0) {
        const newBlocks = [...blocks]
        data.forEach(b => {
          if (b.block_number >= 1 && b.block_number <= 5) {
            newBlocks[b.block_number - 1] = { date: b.start_date, duration: b.duration_weeks || 5 }
          }
        })
        setBlocks(newBlocks)
      }
    }
    fetchBlocks()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const promises = blocks.map((block, index) => {
      if (!block.date) return null
      return supabase
        .from('training_blocks')
        .upsert({ block_number: index + 1, start_date: block.date, duration_weeks: block.duration }, { onConflict: 'block_number' })
    }).filter(Boolean)

    await Promise.all(promises)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const updateBlock = (index: number, field: keyof BlockData, value: string | number) => {
    const newBlocks = [...blocks]
    newBlocks[index] = { ...newBlocks[index], [field]: value }
    setBlocks(newBlocks)
  }

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg"><Calendar className="size-5 text-blue-400" /></div>
        <h2 className="text-lg text-white font-bold">Planification des Blocs</h2>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] gap-4 mb-4 px-2">
        <div className="w-16"></div>
        <div className="text-xs font-bold text-slate-500 uppercase">Date de début</div>
        <div className="text-xs font-bold text-slate-500 uppercase text-center w-24">Durée (Semaines)</div>
      </div>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={index} className="flex items-center gap-4 bg-slate-950 p-2 rounded-lg border border-slate-800/50">
            <label className="text-slate-300 font-bold w-16 text-center">B{index + 1}</label>
            <input
              type="date"
              className="flex-1 bg-transparent p-2 text-white outline-none focus:text-blue-400 transition-colors"
              value={block.date}
              onChange={(e) => updateBlock(index, 'date', e.target.value)}
            />
            <input
              type="number"
              min="1"
              max="12"
              className="w-24 bg-slate-900 p-2 rounded border border-slate-800 text-white text-center outline-none focus:border-blue-500"
              value={block.duration}
              onChange={(e) => updateBlock(index, 'duration', parseInt(e.target.value) || 5)}
            />
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} className={cn("w-full mt-6 p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg", saved ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")}>
        {saving ? 'Sauvegarde...' : saved ? <><Check className="size-5"/> Mémorisé !</> : <><Save className="size-5"/> Enregistrer</>}
      </button>
    </div>
  )
}