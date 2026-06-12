'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, Activity, Check, Moon, Footprints, Battery, Coffee, Plus, Trash2, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  dateActive: Date;
}

interface SetData {
  reps: string;
  weight: string;
  rpe: string;
}

interface ExerciceRow {
  id: string | null;
  name: string;
  coachTracking: SetData[]; 
  tracking: SetData[];      
  comments: string;
}

const LIFT_SQUAT = ['Back Squat', 'Paused Squat', 'Front Squat', 'Tempo Squat', 'Pin Squat']
const LIFT_BENCH = ['Bench Press', 'Paused Bench', 'Close Grip Bench', 'Incline Bench', 'Spoto Press', 'Larsen Press']
const LIFT_DEADLIFT = ['Deadlift', 'Sumo Deadlift', 'Deficit Deadlift', 'Paused Deadlift', 'RDL', 'Block Pulls']
const ACCESSORIES = ['Pull-ups', 'Barbell Row', 'Lat Pulldown', 'Leg Press', 'Bulgarian Split Squat', 'Leg Extensions', 'Leg Curls', 'Bicep Curls', 'Tricep Extensions', 'Gainage (Planche)', 'Ab Rollout']

export default function SessionForm({ dateActive }: Props) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exercices, setExercices] = useState<ExerciceRow[]>([])
  const [fatigue, setFatigue] = useState(5)
  const [sommeil, setSommeil] = useState(8)
  const [pas, setPas] = useState(0)

  const dateFormatee = new Date(dateActive.getTime() - (dateActive.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  const jourSemaine = dateActive.getDay()

  const getExercicesDuJour = () => {
    switch(jourSemaine) {
      case 1: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]
      case 2: return [...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
      case 3: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]
      case 4: return [...LIFT_BENCH, ...ACCESSORIES]
      case 6: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT]
      default: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
    }
  }

  useEffect(() => {
    const chargerSeance = async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('date', dateFormatee)
        .order('created_at', { ascending: false }) // Trie par date la plus récente

      if (data && data.length > 0) {
        const listeExercices = data.map(item => {
          const fallbackCoachTracking = item.coach_reps ? [{ reps: item.coach_reps.toString(), weight: item.coach_weight?.toString() || '', rpe: item.coach_rpe?.toString() || '' }] : [{ reps: '', weight: '', rpe: '' }];
          const savedCoachTracking = item.coach_tracking_data ? item.coach_tracking_data : fallbackCoachTracking;
          let savedTracking = item.tracking_data ? [...item.tracking_data] : [{ reps: '', weight: '', rpe: '' }];

          if (savedTracking.length < savedCoachTracking.length) {
            const lignesManquantes = savedCoachTracking.length - savedTracking.length;
            for (let i = 0; i < lignesManquantes; i++) {
              savedTracking.push({ reps: '', weight: '', rpe: '' });
            }
          }

          return {
            id: item.id,
            name: item.exercise_name || '',
            coachTracking: savedCoachTracking,
            tracking: savedTracking,
            comments: item.comments || '',
          }
        })
        setExercices(listeExercices)
        setFatigue(data[0].fatigue_score || 5)
        setSommeil(data[0].sleep_hours || 8)
        setPas(data[0].steps_count || 0)
      } else {
        setExercices([creerExerciceVierge()])
        setFatigue(5)
        setSommeil(8)
        setPas(0)
      }
    }
    chargerSeance()
  }, [dateActive, dateFormatee])

  const creerExerciceVierge = (): ExerciceRow => ({
    id: null, name: '', 
    coachTracking: [{ reps: '', weight: '', rpe: '' }], 
    tracking: [{ reps: '', weight: '', rpe: '' }], 
    comments: '' 
  })

  const ajouterExercice = () => setExercices([...exercices, creerExerciceVierge()])
  const supprimerExercice = async (index: number, dbId: string | null) => {
    if (dbId) await supabase.from('workout_sets').delete().eq('id', dbId)
    const nouvelleListe = [...exercices]
    nouvelleListe.splice(index, 1)
    setExercices(nouvelleListe)
  }
  const updateExerciceNom = (index: number, valeur: string) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[index].name = valeur
    setExercices(nouvelleListe)
  }
  const updateExerciceCommentaire = (index: number, valeur: string) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[index].comments = valeur
    setExercices(nouvelleListe)
  }

  const ajouterSerieCoach = (exIndex: number) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].coachTracking.push({ reps: '', weight: '', rpe: '' })
    nouvelleListe[exIndex].tracking.push({ reps: '', weight: '', rpe: '' })
    setExercices(nouvelleListe)
  }
  const supprimerSerieCoach = (exIndex: number, setIndex: number) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].coachTracking.splice(setIndex, 1)
    if (nouvelleListe[exIndex].tracking.length > nouvelleListe[exIndex].coachTracking.length) {
      nouvelleListe[exIndex].tracking.splice(setIndex, 1)
    }
    setExercices(nouvelleListe)
  }
  const updateSerieCoach = (exIndex: number, setIndex: number, champ: keyof SetData, valeur: string) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].coachTracking[setIndex] = { ...nouvelleListe[exIndex].coachTracking[setIndex], [champ]: valeur }
    setExercices(nouvelleListe)
  }

  const ajouterSerieAthlete = (exIndex: number) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].tracking.push({ reps: '', weight: '', rpe: '' })
    setExercices(nouvelleListe)
  }
  const supprimerSerieAthlete = (exIndex: number, setIndex: number) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].tracking.splice(setIndex, 1)
    setExercices(nouvelleListe)
  }
  const updateSerieAthlete = (exIndex: number, setIndex: number, champ: keyof SetData, valeur: string) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].tracking[setIndex] = { ...nouvelleListe[exIndex].tracking[setIndex], [champ]: valeur }
    setExercices(nouvelleListe)
  }

  const handleSave = async () => {
    setLoading(true)
    const promesses = exercices.map(ex => {
      const payload = {
        date: dateFormatee,
        exercise_name: ex.name || 'Exercice Non Défini',
        coach_tracking_data: ex.coachTracking,
        tracking_data: ex.tracking,
        comments: ex.comments || null,
        fatigue_score: fatigue,
        sleep_hours: sommeil,
        steps_count: pas
      }
      if (ex.id) return supabase.from('workout_sets').update(payload).eq('id', ex.id)
      else return supabase.from('workout_sets').insert([payload])
    })
    await Promise.all(promesses)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSaveMetricsOnly = async () => {
    setLoading(true)
    const { data } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee).limit(1)
    if (data && data.length > 0) {
      await supabase.from('workout_sets').update({ fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas }).eq('id', data[0].id)
    } else {
      await supabase.from('workout_sets').insert([{ date: dateFormatee, fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas, exercise_name: 'Repos' }])
    }
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (jourSemaine === 0 || jourSemaine === 5) {
    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-full"><Coffee className="size-8 text-slate-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-200">Jour de Repos</h2>
            <p className="text-sm text-slate-500 mt-1">La récupération fait partie de l'entraînement.</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <h3 className="text-sm font-bold text-slate-400 mb-4">Suivi quotidien</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col w-full"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Battery className="size-3 text-red-500"/> Fatigue</span><input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(parseInt(e.target.value))} className="w-full accent-red-500" /></div><span className="text-lg font-bold ml-4 text-white w-6 text-right">{fatigue}</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Moon className="size-3 text-indigo-400"/> Sommeil</span><input type="number" step="0.5" value={sommeil} onChange={(e) => setSommeil(parseFloat(e.target.value))} className="w-16 bg-transparent text-lg font-bold text-white outline-none" /></div><span className="text-xs text-slate-500">h</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Footprints className="size-3 text-orange-400"/> Pas</span><input type="number" value={pas} onChange={(e) => setPas(parseInt(e.target.value))} className="w-full bg-transparent text-lg font-bold text-white outline-none" /></div></div>
          </div>
        </div>
        <button onClick={handleSaveMetricsOnly} disabled={loading} className={cn("w-full p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg", saved ? "bg-emerald-600 shadow-emerald-500/25 text-white" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 text-white")}>
          {loading ? '...' : saved ? 'Suivi Mémorisé !' : 'Enregistrer le suivi'}
        </button>
      </div>
    )
  }

  const suggestionsDuJour = getExercicesDuJour()

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2"><Activity className="size-5 text-blue-500" /> Séance du {dateActive.toLocaleDateString('fr-FR')}</h2>
      <div className="space-y-6">
        {exercices.map((ex, exIndex) => (
          <div key={exIndex} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <input list={`liste-exos-${jourSemaine}`} placeholder="Nom de l'exercice..." className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-white" value={ex.name} onChange={(e) => updateExerciceNom(exIndex, e.target.value)} />
              <datalist id={`liste-exos-${jourSemaine}`}>{suggestionsDuJour.map(n => <option key={n} value={n} />)}</datalist>
              <button onClick={() => supprimerExercice(exIndex, ex.id)} className="text-slate-500 hover:text-red-500"><Trash2 className="size-5" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/30">
                <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase">Prescription Coach</h3>
                {ex.coachTracking.map((set, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-1">
                    <span className="text-xs text-slate-500 pt-2">S{i+1}</span>
                    <input type="number" value={set.reps} onChange={(e) => updateSerieCoach(exIndex, i, 'reps', e.target.value)} className="bg-slate-950 border border-slate-800 rounded text-center" />
                    <input type="number" value={set.weight} onChange={(e) => updateSerieCoach(exIndex, i, 'weight', e.target.value)} className="bg-slate-950 border border-slate-800 rounded text-center" />
                    <input type="number" value={set.rpe} onChange={(e) => updateSerieCoach(exIndex, i, 'rpe', e.target.value)} className="bg-slate-950 border border-slate-800 rounded text-center" />
                  </div>
                ))}
                <button onClick={() => ajouterSerieCoach(exIndex)} className="text-xs text-blue-400 mt-2">+ Ajouter série</button>
              </div>
              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <h3 className="text-xs font-bold text-blue-400 mb-2 uppercase">Validé</h3>
                {ex.tracking.map((set, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-1">
                    <span className="text-xs text-blue-500 pt-2">S{i+1}</span>
                    <input type="number" value={set.reps} onChange={(e) => updateSerieAthlete(exIndex, i, 'reps', e.target.value)} className="bg-slate-950 border border-blue-800 rounded text-center" />
                    <input type="number" value={set.weight} onChange={(e) => updateSerieAthlete(exIndex, i, 'weight', e.target.value)} className="bg-slate-950 border border-blue-800 rounded text-center" />
                    <input type="number" value={set.rpe} onChange={(e) => updateSerieAthlete(exIndex, i, 'rpe', e.target.value)} className="bg-slate-950 border border-blue-800 rounded text-center" />
                  </div>
                ))}
                <button onClick={() => ajouterSerieAthlete(exIndex)} className="text-xs text-blue-400 mt-2">+ Série extra</button>
              </div>
            </div>
            <input placeholder="Notes..." value={ex.comments} onChange={(e) => updateExerciceCommentaire(exIndex, e.target.value)} className="w-full p-2 bg-transparent border border-slate-800 rounded text-sm" />
          </div>
        ))}
      </div>
      <button onClick={ajouterExercice} className="w-full py-3 border-2 border-dashed border-slate-700 text-slate-500 rounded-xl">+ Ajouter un exercice</button>
      <button onClick={handleSave} className="w-full p-4 bg-blue-600 rounded-xl font-bold">Enregistrer séance</button>
    </div>
  )
}