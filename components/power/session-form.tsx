'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, Activity, Check, Moon, Footprints, Battery, Coffee, Plus, Trash2, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  dateActive: Date;
}

// Le modèle d'une SÉRIE individuelle
interface SetData {
  reps: string;
  weight: string;
  rpe: string;
}

// Le modèle d'un EXERCICE
interface ExerciceRow {
  id: string | null;
  name: string;
  coachSets: string;
  coachReps: string;
  coachWeight: string;
  coachRpe: string;
  tracking: SetData[]; // Le tableau qui va stocker toutes les séries réalisées !
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
  const [pas, setPas] = useState(8000)

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

  // LECTURE DE LA BASE DE DONNÉES
  useEffect(() => {
    const chargerSeance = async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('date', dateFormatee)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        const listeExercices = data.map(item => {
          // On récupère le tableau des séries (ou on crée une série vide par défaut)
          const savedTracking = item.tracking_data ? item.tracking_data : [{ reps: '', weight: '', rpe: '' }];
          
          return {
            id: item.id,
            name: item.exercise_name || '',
            coachSets: item.coach_sets?.toString() || '',
            coachReps: item.coach_reps?.toString() || '',
            coachWeight: item.coach_weight?.toString() || '',
            coachRpe: item.coach_rpe?.toString() || '',
            tracking: savedTracking, // Injection du tableau de séries
            comments: item.comments || '',
          }
        })
        setExercices(listeExercices)
        setFatigue(data[0].fatigue_score || 5)
        setSommeil(data[0].sleep_hours || 8)
        setPas(data[0].steps_count || 8000)
      } else {
        setExercices([creerExerciceVierge()])
        setFatigue(5)
        setSommeil(8)
        setPas(8000)
      }
    }
    chargerSeance()
  }, [dateActive])

  // CRÉATION D'UN EXERCICE (Avec 1 série vide par défaut)
  const creerExerciceVierge = (): ExerciceRow => ({
    id: null, name: '', 
    coachSets: '', coachReps: '', coachWeight: '', coachRpe: '',
    tracking: [{ reps: '', weight: '', rpe: '' }], // 1ère série prête à remplir
    comments: '' 
  })

  // GESTION DES EXERCICES
  const ajouterExercice = () => setExercices([...exercices, creerExerciceVierge()])
  const supprimerExercice = async (index: number, dbId: string | null) => {
    if (dbId) await supabase.from('workout_sets').delete().eq('id', dbId)
    const nouvelleListe = [...exercices]
    nouvelleListe.splice(index, 1)
    setExercices(nouvelleListe)
  }
  const updateExercice = (index: number, champ: keyof ExerciceRow, valeur: string) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[index] = { ...nouvelleListe[index], [champ]: valeur }
    setExercices(nouvelleListe)
  }

  // --- GESTION DES SÉRIES (NOUVEAU) ---
  const ajouterSerie = (exIndex: number) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].tracking.push({ reps: '', weight: '', rpe: '' })
    setExercices(nouvelleListe)
  }
  const supprimerSerie = (exIndex: number, setIndex: number) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].tracking.splice(setIndex, 1)
    setExercices(nouvelleListe)
  }
  const updateSerie = (exIndex: number, setIndex: number, champ: keyof SetData, valeur: string) => {
    const nouvelleListe = [...exercices]
    nouvelleListe[exIndex].tracking[setIndex] = { ...nouvelleListe[exIndex].tracking[setIndex], [champ]: valeur }
    setExercices(nouvelleListe)
  }

  // SAUVEGARDE
  const handleSave = async () => {
    setLoading(true)
    const promesses = exercices.map(ex => {
      const payload = {
        date: dateFormatee,
        exercise_name: ex.name || 'Exercice Non Défini',
        coach_sets: ex.coachSets ? parseInt(ex.coachSets) : null,
        coach_reps: ex.coachReps ? parseInt(ex.coachReps) : null,
        coach_weight: ex.coachWeight ? parseFloat(ex.coachWeight) : null,
        coach_rpe: ex.coachRpe ? parseFloat(ex.coachRpe) : null,
        tracking_data: ex.tracking, // Envoi du tableau JSON complet des séries !
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
    
    const { data } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee).order('created_at', { ascending: true })
    if (data) {
      const listeMaj = [...exercices]
      data.forEach((d, i) => { if(listeMaj[i]) listeMaj[i].id = d.id })
      setExercices(listeMaj)
    }
  }

  if (jourSemaine === 0 || jourSemaine === 5) {
    return (
      <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col items-center text-center space-y-4 animate-in fade-in">
        <div className="p-4 bg-slate-800/50 rounded-full"><Coffee className="size-8 text-slate-400" /></div>
        <div>
          <h2 className="text-lg font-bold text-slate-200">Jour de Repos</h2>
          <p className="text-sm text-slate-500 mt-1">La récupération fait partie de l'entraînement.</p>
        </div>
      </div>
    )
  }

  const suggestionsDuJour = getExercicesDuJour()

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Activity className="size-5 text-blue-500" /> Séance du {dateActive.toLocaleDateString('fr-FR')}
        </h2>
      </div>

      <div className="space-y-6">
        {exercices.map((ex, exIndex) => (
          <div key={exIndex} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4 relative group">
            
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 text-slate-400 px-3 py-1 rounded-md text-sm font-bold">{exIndex + 1}</div>
              <input 
                list={`liste-exos-${jourSemaine}`}
                placeholder="Nom de l'exercice..." 
                className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-blue-500 font-medium placeholder:text-slate-600"
                value={ex.name} 
                onChange={(e) => updateExercice(exIndex, 'name', e.target.value)} 
              />
              <datalist id={`liste-exos-${jourSemaine}`}>
                {suggestionsDuJour.map(nomExo => <option key={nomExo} value={nomExo} />)}
              </datalist>
              <button onClick={() => supprimerExercice(exIndex, ex.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                <Trash2 className="size-5" />
              </button>
            </div>

            {/* --- BLOC COACH (Prescription globale) --- */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/30">
              <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Target className="size-3" /> Prescription Coach</h3>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[10px] text-slate-500 uppercase">Séries</label><input type="number" value={ex.coachSets} onChange={(e) => updateExercice(exIndex, 'coachSets', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" /></div>
                <div><label className="text-[10px] text-slate-500 uppercase">Reps</label><input type="number" value={ex.coachReps} onChange={(e) => updateExercice(exIndex, 'coachReps', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" /></div>
                <div><label className="text-[10px] text-slate-500 uppercase">Poids (kg)</label><input type="number" value={ex.coachWeight} onChange={(e) => updateExercice(exIndex, 'coachWeight', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" /></div>
                <div><label className="text-[10px] text-slate-500 uppercase">RPE</label><input type="number" value={ex.coachRpe} onChange={(e) => updateExercice(exIndex, 'coachRpe', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" /></div>
              </div>
            </div>

            {/* --- BLOC ATHLÈTE (Série par Série) --- */}
            <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
              <h3 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Check className="size-3" /> Validé</h3>
              
              {/* En-têtes des colonnes */}
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
                <div className="w-6"></div>
                <div className="text-[10px] text-blue-500/70 uppercase text-center">Reps</div>
                <div className="text-[10px] text-blue-500/70 uppercase text-center">Poids (kg)</div>
                <div className="text-[10px] text-blue-500/70 uppercase text-center">RPE</div>
                <div className="w-6"></div>
              </div>

              {/* Liste des séries dynamiques */}
              <div className="space-y-2">
                {ex.tracking.map((set, setIndex) => (
                  <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                    <span className="w-6 text-xs font-bold text-slate-500 text-center">S{setIndex + 1}</span>
                    <input type="number" value={set.reps} onChange={(e) => updateSerie(exIndex, setIndex, 'reps', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                    <input type="number" value={set.weight} onChange={(e) => updateSerie(exIndex, setIndex, 'weight', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                    <input type="number" step="0.5" value={set.rpe} onChange={(e) => updateSerie(exIndex, setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                    <button onClick={() => supprimerSerie(exIndex, setIndex)} className="w-6 flex justify-center text-slate-600 hover:text-red-400 transition-colors">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => ajouterSerie(exIndex)} className="mt-3 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Plus className="size-3" /> Ajouter une série
              </button>
            </div>

            {/* --- SECTION COMMENTAIRES --- */}
            <div className="mt-2 pt-3 border-t border-slate-800/50">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <MessageSquare className="size-4" /> 
                <span className="text-[10px] font-bold uppercase tracking-wider">Notes & Tempo</span>
              </div>
              <input 
                placeholder="Ex: Tempo 3-1-0, back-off plus lourd, douleur..." 
                value={ex.comments} 
                onChange={(e) => updateExercice(exIndex, 'comments', e.target.value)} 
                className="w-full p-2 bg-transparent border border-slate-800 rounded-md text-sm text-slate-300 outline-none focus:border-blue-500"
              />
            </div>

          </div>
        ))}
      </div>

      <button onClick={ajouterExercice} className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:text-blue-400 text-slate-500 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
        <Plus className="size-5" /> Ajouter un exercice
      </button>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-bold text-slate-400 mb-4">Métriques globales du jour</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col w-full"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Battery className="size-3 text-red-500"/> Fatigue</span><input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(parseInt(e.target.value))} className="w-full accent-red-500" /></div><span className="text-lg font-bold ml-4 text-white w-6 text-right">{fatigue}</span></div>
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Moon className="size-3 text-indigo-400"/> Sommeil</span><input type="number" step="0.5" value={sommeil} onChange={(e) => setSommeil(parseFloat(e.target.value))} className="w-16 bg-transparent text-lg font-bold text-white outline-none" /></div><span className="text-xs text-slate-500">h</span></div>
          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Footprints className="size-3 text-orange-400"/> Pas</span><input type="number" value={pas} onChange={(e) => setPas(parseInt(e.target.value))} className="w-full bg-transparent text-lg font-bold text-white outline-none" /></div></div>
        </div>
      </div>

      <button onClick={handleSave} disabled={loading} className={cn("w-full p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg", saved ? "bg-emerald-600 shadow-emerald-500/25 text-white" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 text-white")}>
        {loading ? 'Enregistrement en cours...' : saved ? <><Check className="size-5" /> Séance Mémorisée !</> : 'Enregistrer la séance'}
      </button>
    </div>
  )
}