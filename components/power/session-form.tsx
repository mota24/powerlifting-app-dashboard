'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, Activity, Check, Moon, Footprints, Battery } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  dateActive: Date;
}

export default function SessionForm({ dateActive }: Props) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null) 

  const [exercice, setExercice] = useState('')
  const [coachWeight, setCoachWeight] = useState('')
  const [coachReps, setCoachReps] = useState('')
  const [coachRpe, setCoachRpe] = useState('')
  const [athleteWeight, setAthleteWeight] = useState('')
  const [athleteReps, setAthleteReps] = useState('')
  const [athleteRpe, setAthleteRpe] = useState('')
  
  // Métriques
  const [fatigue, setFatigue] = useState(5)
  const [sommeil, setSommeil] = useState(8)
  const [pas, setPas] = useState(8000)

  // FORMATAGE DE LA DATE (YYYY-MM-DD)
  const dateFormatee = new Date(dateActive.getTime() - (dateActive.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  // LECTURE INTELLIGENTE : Anti-doublons et chargement complet
  useEffect(() => {
    const chargerSeance = async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('date', dateFormatee)
        .order('created_at', { ascending: false }) // Prend TOUJOURS la plus récente
        .limit(1)

      // Si on trouve une donnée, on remplit TOUTES les cases
      if (data && data.length > 0) {
        const seance = data[0]
        setSessionId(seance.id)
        setExercice(seance.exercise_name || '')
        setCoachWeight(seance.coach_weight?.toString() || '')
        setCoachReps(seance.coach_reps?.toString() || '')
        setCoachRpe(seance.coach_rpe?.toString() || '')
        setAthleteWeight(seance.athlete_weight?.toString() || '')
        setAthleteReps(seance.athlete_reps?.toString() || '')
        setAthleteRpe(seance.athlete_rpe?.toString() || '')
        setFatigue(seance.fatigue_score || 5)
        setSommeil(seance.sleep_hours || 8) // Nouveau !
        setPas(seance.steps_count || 8000) // Nouveau !
      } else {
        // Aucune séance ce jour-là : formulaire vierge
        setSessionId(null)
        setExercice('')
        setCoachWeight('')
        setCoachReps('')
        setCoachRpe('')
        setAthleteWeight('')
        setAthleteReps('')
        setAthleteRpe('')
        setFatigue(5)
        setSommeil(8)
        setPas(8000)
      }
    }
    chargerSeance()
  }, [dateActive])

  // SAUVEGARDE COMPLÈTE
  const handleSave = async () => {
    setLoading(true)
    
    // Le paquet de données envoyé à Supabase
    const payload = {
      date: dateFormatee,
      exercise_name: exercice || 'Exercice Non Défini',
      coach_weight: coachWeight ? parseFloat(coachWeight) : null,
      coach_reps: coachReps ? parseInt(coachReps) : null,
      coach_rpe: coachRpe ? parseFloat(coachRpe) : null,
      athlete_weight: athleteWeight ? parseFloat(athleteWeight) : null,
      athlete_reps: athleteReps ? parseInt(athleteReps) : null,
      athlete_rpe: athleteRpe ? parseFloat(athleteRpe) : null,
      fatigue_score: fatigue,
      sleep_hours: sommeil, // Ajouté à l'enregistrement
      steps_count: pas      // Ajouté à l'enregistrement
    }

    let result;
    if (sessionId) {
      result = await supabase.from('workout_sets').update(payload).eq('id', sessionId)
    } else {
      result = await supabase.from('workout_sets').insert([payload])
    }

    setLoading(false)
    if (result.error) {
      alert("Erreur de sauvegarde: " + result.error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      
      // Sécurise l'ID pour ne pas créer de doublons si on re-sauvegarde direct
      if (!sessionId) {
        const { data } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee).order('created_at', { ascending: false }).limit(1)
        if (data && data.length > 0) setSessionId(data[0].id)
      }
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h2 className="text-lg font-bold text-slate-200 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2"><Activity className="size-5 text-blue-500" /> Saisie de la Série</span>
          <span className="text-xs text-slate-500 font-normal">{dateFormatee}</span>
        </h2>
        <input placeholder="Ex: Back Squat, Bench Press..." className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-blue-500" value={exercice} onChange={(e) => setExercice(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30">
          <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><Target className="size-4" /> Programmation</h3>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-500">Charge (kg)</label><input type="number" value={coachWeight} onChange={(e) => setCoachWeight(e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 outline-none focus:border-slate-500" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-slate-500">Reps</label><input type="number" value={coachReps} onChange={(e) => setCoachReps(e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 outline-none focus:border-slate-500" /></div>
              <div><label className="text-xs text-slate-500">RPE</label><input type="number" value={coachRpe} onChange={(e) => setCoachRpe(e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 outline-none focus:border-slate-500" /></div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
          <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2"><Check className="size-4" /> Réalisé</h3>
          <div className="space-y-3">
            <div><label className="text-xs text-blue-500/70">Charge (kg)</label><input type="number" value={athleteWeight} onChange={(e) => setAthleteWeight(e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white outline-none focus:border-blue-500" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-blue-500/70">Reps</label><input type="number" value={athleteReps} onChange={(e) => setAthleteReps(e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-blue-500/70">RPE</label><input type="number" step="0.5" value={athleteRpe} onChange={(e) => setAthleteRpe(e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white outline-none focus:border-blue-500" /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-bold text-slate-400 mb-4">Métriques du jour</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Battery className="size-3 text-red-500"/> Fatigue</span><input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(parseInt(e.target.value))} className="w-full accent-red-500" /></div><span className="text-lg font-bold ml-2 text-white">{fatigue}</span></div>
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Moon className="size-3 text-indigo-400"/> Sommeil</span><input type="number" step="0.5" value={sommeil} onChange={(e) => setSommeil(parseFloat(e.target.value))} className="w-16 bg-transparent text-lg font-bold text-white outline-none" /></div><span className="text-xs text-slate-500">heures</span></div>
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Footprints className="size-3 text-orange-400"/> Pas</span><input type="number" value={pas} onChange={(e) => setPas(parseInt(e.target.value))} className="w-full bg-transparent text-lg font-bold text-white outline-none" /></div></div>
        </div>
      </div>

      <button onClick={handleSave} disabled={loading} className={cn("w-full p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2", saved ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")}>
        {loading ? 'Enregistrement en cours...' : saved ? <><Check className="size-5" /> Séance Mémorisée !</> : 'Enregistrer la séance'}
      </button>
    </div>
  )
}