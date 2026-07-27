'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { toLocalDateStr, setsTonnage, painLabel, weeksOut, type SetData, type UpcomingCompetition } from '../../lib/powerlifting'
import { countryCodeToFlag } from '../../lib/countries'
import { Plus, Trash2, Calendar, Settings, RefreshCw, Download, Tag, Trophy } from 'lucide-react'

interface TrainingBlock { id: string; block_number: number; start_date: string; duration_weeks: number; name?: string; }
const parseLocalDate = (dateStr: string): Date => { const [annee, mois, jour] = dateStr.split('-').map(Number); return new Date(annee, mois - 1, jour) }
const numeroSemaineDansBloc = (debutBloc: string, date: string): number => { const diffJours = Math.round((parseLocalDate(date).getTime() - parseLocalDate(debutBloc).getTime()) / 86_400_000); return Math.floor(diffJours / 7) + 1 }

export default function ConfigPanel() {
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [nextCompetition, setNextCompetition] = useState<UpcomingCompetition | null>(null)

  const fetchBlocks = async () => {
    setLoading(true)
    const { data } = await supabase.from('training_blocks').select('*').order('block_number', { ascending: true })
    if (data) setBlocks(data)
    setLoading(false)
  }

  useEffect(() => { fetchBlocks() }, [])

  useEffect(() => {
    let cancelled = false
    const fetchNextCompetition = async () => {
      const { data } = await supabase
        .from('competitions')
        .select('id, name, date, level, country_code')
        .gte('date', toLocalDateStr(new Date()))
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setNextCompetition(data ?? null)
    }
    fetchNextCompetition()
    return () => { cancelled = true }
  }, [])

  const ajouterBloc = async () => {
    const nextNumber = blocks.length > 0 ? Math.max(...blocks.map(b => b.block_number)) + 1 : 1
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.from('training_blocks').insert([{ block_number: nextNumber, start_date: today, duration_weeks: 4, name: 'NOUVEAU BLOC' }]).select()
    if (data) setBlocks([...blocks, data[0]])
    if (error) alert("Erreur : " + error.message)
  }

  const supprimerBloc = async (id: string) => {
    if (!confirm("SUPPRIMER CE BLOC DÉFINITIVEMENT ?")) return
    const { error } = await supabase.from('training_blocks').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    setBlocks((prev) => prev.filter(b => b.id !== id))
  }

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  useEffect(() => { const timers = debounceRef.current; return () => { Object.values(timers).forEach(clearTimeout) } }, [])

  const updateBlock = (id: string, field: keyof TrainingBlock, value: string | number) => {
    setBlocks((prev) => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
    const key = `${id}:${field}`
    clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(async () => {
      const { error } = await supabase.from('training_blocks').update({ [field]: value }).eq('id', id)
      if (error) alert('Erreur de sauvegarde : ' + error.message)
    }, 800)
  }

  const telechargerBloc = async (block: TrainingBlock) => {
    setDownloadingId(block.id)
    try {
      const aujourdhuiStr = toLocalDateStr(new Date())
      const debutBloc = parseLocalDate(block.start_date)
      const finBloc = new Date(debutBloc)
      finBloc.setDate(debutBloc.getDate() + block.duration_weeks * 7 - 1)
      const finBlocStr = toLocalDateStr(finBloc)

      // 1. On aspire TOUTES les données du bloc sans blocage de date
      const { data: allData, error } = await supabase
        .from('workout_sets')
        .select('*')
        .gte('date', block.start_date)
        .lte('date', finBlocStr)
        .order('date', { ascending: true })
        .order('order_index', { ascending: true })
        
      if (error) throw error; 
      if (!allData || allData.length === 0) { alert("AUCUNE SÉANCE ENREGISTRÉE."); return }

      // 2. Le scan intelligent : on cherche le dernier jour où un chiffre a été écrit (par le coach ou l'athlète)
      let derniereDateRemplie = block.start_date;
      for (const row of allData) {
        const coachData = Array.isArray(row.coach_tracking_data) ? row.coach_tracking_data : [];
        const athleteData = Array.isArray(row.tracking_data) ? row.tracking_data : [];
        
        const coachRempli = coachData.some((s: any) => (s.reps && s.reps.toString().trim() !== '') || (s.weight && s.weight.toString().trim() !== ''));
        const athleteRempli = athleteData.some((s: any) => (s.reps && s.reps.toString().trim() !== '') || (s.weight && s.weight.toString().trim() !== ''));
        
        if ((coachRempli || athleteRempli) && row.date > derniereDateRemplie) {
          derniereDateRemplie = row.date;
        }
      }

      // 3. On filtre pour ne garder que les séances jusqu'à cette dernière date
      const data = allData.filter(row => row.date <= derniereDateRemplie);

      const parJour = new Map<string, any[]>()
      for (const row of data) { const lignes = parJour.get(row.date) ?? []; lignes.push(row); parJour.set(row.date, lignes) }

      const formatCote = (set: any, texteSiVide: string) => (set.reps || set.weight) ? `${set.reps || '-'} reps @ ${set.weight || '-'} kg (RPE ${set.rpe || '-'})` : texteSiVide

      let contenu = `=== HISTORIQUE DU BLOC ${block.block_number}${block.name ? ` (${block.name})` : ''} ===\n`
      contenu += `Période exportée : ${block.start_date} → ${derniereDateRemplie} (export généré le ${aujourdhuiStr})\n`

      let semaineAffichee = 0
      for (const [date, lignes] of parJour) {
        const numSemaine = numeroSemaineDansBloc(block.start_date, date)
        if (numSemaine !== semaineAffichee) { semaineAffichee = numSemaine; contenu += `\n━━━━━━━━━━ SEMAINE ${numSemaine} / ${block.duration_weeks} ━━━━━━━━━━\n\n` }
        const nomJour = parseLocalDate(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
        const ref = lignes[lignes.length - 1]
        const metriques = `Fatigue ${ref.fatigue_score ?? '-'}/10 · Sommeil ${ref.sleep_hours ?? '-'} h · ${ref.steps_count ?? '-'} pas`
        const exercicesDuJour = lignes.filter((r) => r.exercise_name !== 'Jour de Repos' && r.exercise_name !== 'Repos')
        if (exercicesDuJour.length === 0) { contenu += `📅 ${nomJour} (${date}) — JOUR DE REPOS\n   ${metriques}\n\n`; continue }
        const tonnageDuJour = Math.round(exercicesDuJour.reduce((sum, r) => sum + setsTonnage(r.tracking_data as SetData[] | null), 0))
        contenu += `📅 ${nomJour} (${date})\n   ${metriques}${tonnageDuJour > 0 ? ` · Tonnage ${tonnageDuJour.toLocaleString('fr-FR')} kg` : ''}\n`
        const rienRempli = exercicesDuJour.every((r) => { const athlete = Array.isArray(r.tracking_data) ? r.tracking_data : []; return !athlete.some((s: any) => (s.reps && s.reps.toString().trim() !== '') || (s.weight && s.weight.toString().trim() !== '')) })
        if (rienRempli) { contenu += `   ⚠ SÉANCE NON RENSEIGNÉE PAR L'ATHLÈTE\n` }
        exercicesDuJour.forEach((row, idx) => {
          const douleur = painLabel(row.pain_level)
          contenu += `\n   ${idx + 1}. ${row.exercise_name || 'Exercice sans nom'}${douleur ? `   [Douleur : ${douleur}]` : ''}\n`
          const coachData = Array.isArray(row.coach_tracking_data) ? row.coach_tracking_data : []
          const athleteData = Array.isArray(row.tracking_data) ? row.tracking_data : []
          const maxSets = Math.max(coachData.length, athleteData.length)
          for (let i = 0; i < maxSets; i++) {
            const cSet = coachData[i] || {}; const aSet = athleteData[i] || {}
            if (!(cSet.reps || cSet.weight || aSet.reps || aSet.weight)) continue
            contenu += `      S${i + 1} | COACH → [ ${formatCote(cSet, 'Rien de prévu')} ]  ||  ATHLÈTE → [ ${formatCote(aSet, 'Non renseigné')} ]\n`
          }
          if (row.comments) contenu += `      NOTES : ${row.comments}\n`
        })
        contenu += `\n${'-'.repeat(60)}\n\n`
      }
      const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob); const lien = document.createElement('a'); lien.href = url
      const safeName = block.name ? `_${block.name.replace(/[^a-z0-9]/gi, '_')}` : ''
      lien.download = `Bloc_${block.block_number}${safeName}_export_${aujourdhuiStr}.txt`
      document.body.appendChild(lien); lien.click(); document.body.removeChild(lien); URL.revokeObjectURL(url)
    } catch (err: any) { alert("Erreur d'export : " + err.message) } finally { setDownloadingId(null) }
  }

  if (loading) return <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 animate-pulse">CHARGEMENT...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Settings className="size-5 text-white" />
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Configuration</h2>
        </div>
        <button onClick={fetchBlocks} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors">
          <RefreshCw className="size-4" />
        </button>
      </div>

      <div className="space-y-4">
        {blocks.map((block) => (
          <div key={block.id} className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
            
            <div className="flex items-center gap-4">
              <div className="bg-white text-black px-4 py-3 rounded-xl font-black text-xl tabular-nums">
                B{block.block_number}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">N°</span>
                <input 
                  type="number" 
                  value={block.block_number} 
                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) updateBlock(block.id, 'block_number', n) }}
                  className="bg-transparent text-white font-black tabular-nums text-lg outline-none w-16"
                />
              </div>
            </div>

            <div className="flex flex-col w-full xl:w-auto">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Tag className="size-3" /> Nom du bloc</span>
              <input 
                type="text" 
                list="block-names"
                value={block.name || ''} 
                onChange={(e) => updateBlock(block.id, 'name', e.target.value)}
                placeholder="EX: RÉÉDUCATION"
                className="bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-white w-full xl:w-48 transition-colors"
              />
              <datalist id="block-names">
                <option value="RÉÉDUCATION" />
                <option value="HYPERTROPHIE" />
                <option value="FORCE" />
                <option value="DÉCHARGE" />
                <option value="PEAKING" />
              </datalist>
            </div>

            <div className="flex flex-col w-full xl:w-auto">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Calendar className="size-3" /> Début</span>
              <input 
                type="date" 
                value={block.start_date} 
                onChange={(e) => updateBlock(block.id, 'start_date', e.target.value)}
                className="bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-white w-full xl:w-40 transition-colors"
              />
            </div>

            <div className="flex flex-col w-full xl:w-auto">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Semaines</span>
              <input 
                type="number" 
                value={block.duration_weeks} 
                onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n) && n > 0) updateBlock(block.id, 'duration_weeks', n) }}
                className="bg-black border border-zinc-800 rounded-xl p-3 text-sm font-black tabular-nums text-white outline-none focus:border-white w-full xl:w-24 text-center transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto justify-end mt-2 xl:mt-0 pt-4 xl:pt-0 border-t border-zinc-900 xl:border-0">
              <button onClick={() => telechargerBloc(block)} disabled={downloadingId === block.id} className="p-4 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50">
                {downloadingId === block.id ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
              </button>
              <button onClick={() => supprimerBloc(block.id)} className="p-4 bg-zinc-900 text-zinc-500 hover:text-red-500 hover:bg-red-950/50 rounded-xl transition-colors">
                <Trash2 className="size-4" />
              </button>
            </div>

          </div>
        ))}

        {nextCompetition && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="shrink-0 bg-orange-500/10 text-orange-500 p-3 rounded-xl">
                <Trophy className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">🏆 Comp Day</h3>
                <p className="truncate text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {nextCompetition.name}
                  {nextCompetition.country_code && ` ${countryCodeToFlag(nextCompetition.country_code)}`}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-lg font-black tabular-nums text-white">
                {parseLocalDate(nextCompetition.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-orange-500">
                {(() => { const s = weeksOut(toLocalDateStr(new Date()), nextCompetition.date); return s > 0 ? `S-${s}` : 'S0' })()}
              </div>
            </div>
          </div>
        )}

        <button onClick={ajouterBloc} className="w-full py-6 border border-zinc-800 hover:border-white text-zinc-500 hover:text-white bg-zinc-950 rounded-2xl flex items-center justify-center gap-2 transition-colors text-[10px] font-bold uppercase tracking-widest mt-6">
          <Plus className="size-4" /> NOUVEAU BLOC
        </button>
      </div>
    </div>
  )
}