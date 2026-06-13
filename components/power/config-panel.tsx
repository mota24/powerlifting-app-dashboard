'use client'

import { useState, useEffect } from 'react'
//import { supabase } from '@/lib/supabase'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Calendar, Settings, RefreshCw } from 'lucide-react'

interface TrainingBlock {
  id: string;
  block_number: number;
  start_date: string;
  duration_weeks: number;
}

export default function ConfigPanel() {
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBlocks()
  }, [])

  const fetchBlocks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('training_blocks')
      .select('*')
      .order('block_number', { ascending: true })
    
    if (data) setBlocks(data)
    setLoading(false)
  }

  const ajouterBloc = async () => {
    const nextNumber = blocks.length > 0 ? Math.max(...blocks.map(b => b.block_number)) + 1 : 1
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('training_blocks')
      .insert([{ block_number: nextNumber, start_date: today, duration_weeks: 5 }])
      .select()

    if (data) setBlocks([...blocks, data[0]])
    if (error) alert("Erreur lors de l'ajout : " + error.message)
  }

  const supprimerBloc = async (id: string) => {
    if (!confirm("Es-tu sûr de vouloir supprimer ce bloc ?")) return

    await supabase.from('training_blocks').delete().eq('id', id)
    setBlocks(blocks.filter(b => b.id !== id))
  }

  const updateBlock = async (id: string, field: string, value: string | number) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b))
    await supabase.from('training_blocks').update({ [field]: value }).eq('id', id)
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Chargement de la configuration...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Settings className="size-5 text-blue-500" /> Gestion des Blocs
        </h2>
        <button onClick={fetchBlocks} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          <RefreshCw className="size-4" />
        </button>
      </div>

      <div className="space-y-4">
        {blocks.map((block) => (
          <div key={block.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-blue-500/10 text-blue-400 px-3 py-2 rounded-lg font-black text-lg border border-blue-500/20">
                B{block.block_number}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Numéro du bloc</span>
                <input 
                  type="number" 
                  value={block.block_number} 
                  onChange={(e) => updateBlock(block.id, 'block_number', parseInt(e.target.value))}
                  className="bg-transparent text-white font-bold outline-none border-b border-transparent focus:border-slate-700 w-16"
                />
              </div>
            </div>

            <div className="flex flex-col w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="size-3" /> Date de début</span>
              <input 
                type="date" 
                value={block.start_date} 
                onChange={(e) => updateBlock(block.id, 'start_date', e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-300 outline-none focus:border-blue-500 mt-1"
              />
            </div>

            <div className="flex flex-col w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Durée (Semaines)</span>
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="number" 
                  value={block.duration_weeks} 
                  onChange={(e) => updateBlock(block.id, 'duration_weeks', parseInt(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-300 outline-none focus:border-blue-500 w-20 text-center"
                />
              </div>
            </div>

            <button onClick={() => supprimerBloc(block.id)} className="p-3 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors w-full md:w-auto flex justify-center">
              <Trash2 className="size-5" />
            </button>

          </div>
        ))}

        <button onClick={ajouterBloc} className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:text-blue-400 text-slate-500 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold mt-4">
          <Plus className="size-5" /> Ajouter un nouveau bloc
        </button>
      </div>
    </div>
  )
}