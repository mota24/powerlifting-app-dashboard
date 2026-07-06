'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Calendar, Settings, RefreshCw, Download, Tag } from 'lucide-react'

interface TrainingBlock {
  id: string;
  block_number: number;
  start_date: string;
  duration_weeks: number;
  name?: string;
}

export default function ConfigPanel() {
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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
      .insert([{ block_number: nextNumber, start_date: today, duration_weeks: 4, name: 'Nouveau Bloc' }])
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

  const telechargerBloc = async (block: TrainingBlock) => {
    setDownloadingId(block.id)
    
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(block.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (block.duration_weeks * 7) - 1);
    const blockEndDateStr = endDate.toISOString().split('T')[0];
    
    const maxDate = today < blockEndDateStr ? today : blockEndDateStr;

    try {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .gte('date', block.start_date)
        .lte('date', maxDate)
        .order('date', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) {
        alert("Aucune séance n'a encore été validée pour ce bloc.")
        setDownloadingId(null)
        return
      }

      let contenu = `=== HISTORIQUE DU BLOC ${block.block_number} ${block.name ? `(${block.name})` : ''} ===\n\n`
      
      data.forEach((row) => {
        contenu += `DATE: ${row.date}\n`
        contenu += `EXERCICE: ${row.exercise_name}\n`
        
        if (row.tracking_data && Array.isArray(row.tracking_data)) {
          contenu += `SÉRIES RÉALISÉES:\n`
          row.tracking_data.forEach((set: any, index: number) => {
            if (set.reps || set.weight) {
              contenu += `  S${index + 1}: ${set.reps} reps @ ${set.weight} kg (RPE: ${set.rpe || '-'})\n`
            }
          })
        }
        
        if (row.comments) contenu += `NOTES: ${row.comments}\n`
        contenu += `MÉTRIQUES -> Fatigue: ${row.fatigue_score}/10 | Sommeil: ${row.sleep_hours}h | Pas: ${row.steps_count}\n`
        contenu += "--------------------------------------------------\n\n"
      })

      const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      const safeName = block.name ? `_${block.name.replace(/[^a-z0-9]/gi, '_')}` : ''
      lien.download = `Bloc_${block.block_number}${safeName}_export_${today}.txt`
      document.body.appendChild(lien)
      lien.click()
      document.body.removeChild(lien)
      URL.revokeObjectURL(url)
      
    } catch (err: any) {
      alert("Erreur lors du téléchargement : " + err.message)
    } finally {
      setDownloadingId(null)
    }
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
        <button onClick={fetchBlocks} title="Rafraîchir" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          <RefreshCw className="size-5" />
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
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">N°</span>
                <input 
                  type="number" 
                  value={block.block_number} 
                  onChange={(e) => updateBlock(block.id, 'block_number', parseInt(e.target.value))}
                  className="bg-transparent text-white font-bold outline-none border-b border-transparent focus:border-slate-700 w-12"
                />
              </div>
            </div>

            {/* NOUVEAU CHAMP : NOM DU BLOC */}
            <div className="flex flex-col w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Tag className="size-3" /> Nom du bloc</span>
              <input 
                type="text" 
                list="block-names"
                value={block.name || ''} 
                onChange={(e) => updateBlock(block.id, 'name', e.target.value)}
                placeholder="Ex: Rééducation..."
                className="bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-300 outline-none focus:border-blue-500 mt-1 min-w-[140px]"
              />
              <datalist id="block-names">
                <option value="Rééducation" />
                <option value="Hypertrophie" />
                <option value="Force (Charge)" />
                <option value="Décharge (Deload)" />
                <option value="Pré-comp (Peaking)" />
              </datalist>
            </div>

            <div className="flex flex-col w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="size-3" /> Début</span>
              <input 
                type="date" 
                value={block.start_date} 
                onChange={(e) => updateBlock(block.id, 'start_date', e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-300 outline-none focus:border-blue-500 mt-1"
              />
            </div>

            <div className="flex flex-col w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Semaines</span>
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="number" 
                  value={block.duration_weeks} 
                  onChange={(e) => updateBlock(block.id, 'duration_weeks', parseInt(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-300 outline-none focus:border-blue-500 w-16 text-center"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-center mt-4 md:mt-0">
              <button 
                onClick={() => telechargerBloc(block)} 
                disabled={downloadingId === block.id}
                className="p-3 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                title="Télécharger l'historique du bloc"
              >
                {downloadingId === block.id ? <RefreshCw className="size-5 animate-spin" /> : <Download className="size-5" />}
              </button>

              <button onClick={() => supprimerBloc(block.id)} className="p-3 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                <Trash2 className="size-5" />
              </button>
            </div>

          </div>
        ))}

        <button onClick={ajouterBloc} className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:text-blue-400 text-slate-500 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold mt-4">
          <Plus className="size-5" /> Ajouter un nouveau bloc
        </button>
      </div>
    </div>
  )
}