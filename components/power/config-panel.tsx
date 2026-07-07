'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { toLocalDateStr, setsTonnage, painLabel, type SetData } from '../../lib/powerlifting'
import { Plus, Trash2, Calendar, Settings, RefreshCw, Download, Tag } from 'lucide-react'

interface TrainingBlock {
  id: string;
  block_number: number;
  start_date: string;
  duration_weeks: number;
  name?: string;
}

/** Parse "YYYY-MM-DD" en Date locale (new Date("YYYY-MM-DD") serait interprété en UTC) */
const parseLocalDate = (dateStr: string): Date => {
  const [annee, mois, jour] = dateStr.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}

/** Numéro de semaine (1-indexé) d'une date au sein d'un bloc */
const numeroSemaineDansBloc = (debutBloc: string, date: string): number => {
  const diffJours = Math.round(
    (parseLocalDate(date).getTime() - parseLocalDate(debutBloc).getTime()) / 86_400_000
  )
  return Math.floor(diffJours / 7) + 1
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

    const { error } = await supabase.from('training_blocks').delete().eq('id', id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    setBlocks((prev) => prev.filter(b => b.id !== id))
  }

  // Écriture différée : l'UI répond instantanément, la base n'est touchée
  // qu'après 800 ms sans frappe (au lieu d'un UPDATE par caractère).
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  useEffect(() => {
    const timers = debounceRef.current
    return () => { Object.values(timers).forEach(clearTimeout) }
  }, [])

  const updateBlock = (id: string, field: keyof TrainingBlock, value: string | number) => {
    setBlocks((prev) => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
    const key = `${id}:${field}`
    clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(async () => {
      const { error } = await supabase.from('training_blocks').update({ [field]: value }).eq('id', id)
      if (error) alert('Erreur de sauvegarde du bloc : ' + error.message)
    }, 800)
  }

  const telechargerBloc = async (block: TrainingBlock) => {
    setDownloadingId(block.id)

    try {
      const aujourdhuiStr = toLocalDateStr(new Date())

      // Bornes du bloc en heure locale (toISOString basculerait d'un jour entre minuit et 2h)
      const debutBloc = parseLocalDate(block.start_date)
      const finBloc = new Date(debutBloc)
      finBloc.setDate(debutBloc.getDate() + block.duration_weeks * 7 - 1)
      const finBlocStr = toLocalDateStr(finBloc)

      // RÈGLE STRICTE : l'export s'arrête au jour actuel. Les semaines futures n'apparaissent jamais.
      const dateLimite = aujourdhuiStr < finBlocStr ? aujourdhuiStr : finBlocStr

      if (block.start_date > dateLimite) {
        alert("Ce bloc n'a pas encore commencé : rien à exporter.")
        return
      }

      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .gte('date', block.start_date)
        .lte('date', dateLimite)
        .order('date', { ascending: true })
        .order('order_index', { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) {
        alert("Aucune séance enregistrée entre le début du bloc et aujourd'hui.")
        return
      }

      // Regroupement chronologique par journée
      const parJour = new Map<string, any[]>()
      for (const row of data) {
        const lignes = parJour.get(row.date) ?? []
        lignes.push(row)
        parJour.set(row.date, lignes)
      }

      const formatCote = (set: any, texteSiVide: string) =>
        (set.reps || set.weight)
          ? `${set.reps || '-'} reps @ ${set.weight || '-'} kg (RPE ${set.rpe || '-'})`
          : texteSiVide

      let contenu = `=== HISTORIQUE DU BLOC ${block.block_number}${block.name ? ` (${block.name})` : ''} ===\n`
      contenu += `Période exportée : ${block.start_date} → ${dateLimite} (export généré le ${aujourdhuiStr})\n`

      let semaineAffichee = 0

      for (const [date, lignes] of parJour) {
        const numSemaine = numeroSemaineDansBloc(block.start_date, date)
        if (numSemaine !== semaineAffichee) {
          semaineAffichee = numSemaine
          contenu += `\n━━━━━━━━━━ SEMAINE ${numSemaine} / ${block.duration_weeks} ━━━━━━━━━━\n\n`
        }

        const nomJour = parseLocalDate(date)
          .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
          .toUpperCase()

        // Les métriques quotidiennes sont dupliquées sur chaque ligne du jour : on lit la dernière
        const ref = lignes[lignes.length - 1]
        const metriques = `Fatigue ${ref.fatigue_score ?? '-'}/10 · Sommeil ${ref.sleep_hours ?? '-'} h · ${ref.steps_count ?? '-'} pas`

        const exercicesDuJour = lignes.filter(
          (r) => r.exercise_name !== 'Jour de Repos' && r.exercise_name !== 'Repos'
        )

        if (exercicesDuJour.length === 0) {
          contenu += `📅 ${nomJour} (${date}) — JOUR DE REPOS\n   ${metriques}\n\n`
          continue
        }

        const tonnageDuJour = Math.round(
          exercicesDuJour.reduce((sum, r) => sum + setsTonnage(r.tracking_data as SetData[] | null), 0)
        )

        contenu += `📅 ${nomJour} (${date})\n   ${metriques}${tonnageDuJour > 0 ? ` · Tonnage ${tonnageDuJour.toLocaleString('fr-FR')} kg` : ''}\n`

        const rienRempli = exercicesDuJour.every((r) => {
          const athlete = Array.isArray(r.tracking_data) ? r.tracking_data : []
          return !athlete.some(
            (s: any) =>
              (s.reps && s.reps.toString().trim() !== '') ||
              (s.weight && s.weight.toString().trim() !== '')
          )
        })
        if (rienRempli) {
          contenu += `   ⚠ SÉANCE NON RENSEIGNÉE PAR L'ATHLÈTE (prescription coach ci-dessous)\n`
        }

        exercicesDuJour.forEach((row, idx) => {
          const douleur = painLabel(row.pain_level)
          contenu += `\n   ${idx + 1}. ${row.exercise_name || 'Exercice sans nom'}${douleur ? `   [Douleur : ${douleur}]` : ''}\n`

          const coachData = Array.isArray(row.coach_tracking_data) ? row.coach_tracking_data : []
          const athleteData = Array.isArray(row.tracking_data) ? row.tracking_data : []
          const maxSets = Math.max(coachData.length, athleteData.length)

          for (let i = 0; i < maxSets; i++) {
            const cSet = coachData[i] || {}
            const aSet = athleteData[i] || {}
            if (!(cSet.reps || cSet.weight || aSet.reps || aSet.weight)) continue
            contenu += `      S${i + 1} | COACH → [ ${formatCote(cSet, 'Rien de prévu')} ]  ||  ATHLÈTE → [ ${formatCote(aSet, 'Non renseigné')} ]\n`
          }

          if (row.comments) contenu += `      NOTES : ${row.comments}\n`
        })

        contenu += `\n${'-'.repeat(60)}\n\n`
      }

      const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      const safeName = block.name ? `_${block.name.replace(/[^a-z0-9]/gi, '_')}` : ''
      lien.download = `Bloc_${block.block_number}${safeName}_export_${aujourdhuiStr}.txt`
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
                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) updateBlock(block.id, 'block_number', n) }}
                  className="bg-transparent text-white font-bold outline-none border-b border-transparent focus:border-slate-700 w-12"
                />
              </div>
            </div>

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
                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n) && n > 0) updateBlock(block.id, 'duration_weeks', n) }}
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