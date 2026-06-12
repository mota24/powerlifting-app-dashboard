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
// LECTURE DE LA BASE DE DONNÉES
  // LECTURE DE LA BASE DE DONNÉES
  useEffect(() => {
    const chargerSeance = async () => {
      const { data } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('date', dateFormatee)
        .order('created_at', { ascending: true }) // <-- REMIS À TRUE POUR GARDER L'ORDRE (Squat en premier)

      if (data && data.length > 0) {
        // L'iPhone met à jour la ligne la plus récente, on prend donc les métriques sur la DERNIÈRE ligne trouvée
        const derniereLigne = data[data.length - 1];

        // On nettoie : si la journée a de vrais exercices, on ignore la ligne "Repos" générée par l'iPhone
        const vraisExercices = data.filter(item => item.exercise_name !== 'Repos' && item.exercise_name !== 'Jour de Repos');
        // On trie les vrais exercices selon la position exacte que tu as sauvegardée
        vraisExercices.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

        if (vraisExercices.length > 0) {
          const listeExercices = vraisExercices.map(item => {
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
          });
          setExercices(listeExercices);
        } else {
          setExercices([creerExerciceVierge()]);
        }

        // On applique les métriques globales
        setFatigue(derniereLigne.fatigue_score || 5);
        setSommeil(derniereLigne.sleep_hours || 8);
        setPas(derniereLigne.steps_count || 0);

      } else {
        setExercices([creerExerciceVierge()]);
        setFatigue(5);
        setSommeil(8);
        setPas(0);
      }
    };
    chargerSeance();
  }, [dateActive, dateFormatee]);

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

  // SAUVEGARDE POUR UNE SÉANCE NORMALE
  // Fonction pour copier la semaine 1 sur tout le reste du bloc
  const propagerSemaine1VersBloc = async () => {
    if (!confirm("Voulez-vous copier les exercices de la Semaine 1 sur toutes les semaines du bloc ?")) return;
    
    setLoading(true);

    // 1. Récupérer les données de la semaine 1 (on part de la date de début du bloc)
    // Ici on suppose que ta dateActive est dans la semaine 1
    const { data: semaine1Data } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('date', dateFormatee); // Ta variable existante pour la date de la semaine 1

    if (!semaine1Data || semaine1Data.length === 0) {
      alert("Aucune donnée trouvée en Semaine 1.");
      setLoading(false);
      return;
    }

    // 2. Propagation
    // On boucle sur les semaines 2, 3, 4, 5 (soit un décalage de +7, +14, +21, +28 jours)
    const deltas = [7, 14, 21, 28];
    const insertions = [];

    for (const delta of deltas) {
      const dateCible = new Date(dateActive);
      dateCible.setDate(dateCible.getDate() + delta);
      const dateCibleStr = dateCible.toISOString().split('T')[0];

      for (const item of semaine1Data) {
        // On prépare la copie sans l'ID (pour créer une nouvelle ligne)
        const { id, created_at, ...dataToCopy } = item;
        insertions.push({ ...dataToCopy, date: dateCibleStr });
      }
    }

    // 3. Insertion par lots dans Supabase
    await supabase.from('workout_sets').insert(insertions);
    
    setLoading(false);
    alert("Semaine 1 propagée avec succès sur le bloc !");
  };
  const handleSave = async () => {
    setLoading(true)
    
    // On ajoute 'index' ici pour connaître la position de l'exercice (0, 1, 2...)
    const promesses = exercices.map((ex, index) => {
      const payload = {
        date: dateFormatee,
        exercise_name: ex.name || 'Exercice Non Défini',
        coach_tracking_data: ex.coachTracking,
        tracking_data: ex.tracking,
        comments: ex.comments || null,
        fatigue_score: fatigue,
        sleep_hours: sommeil,
        steps_count: pas,
        order_index: index // <-- C'est ici qu'on fige l'ordre exact !
      }
      
      if (ex.id) return supabase.from('workout_sets').update(payload).eq('id', ex.id)
      else return supabase.from('workout_sets').insert([payload])
    })

    await Promise.all(promesses)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    
    // On récupère les ID fraîchement créés, mais triés par notre nouvel ordre
    const { data } = await supabase
      .from('workout_sets')
      .select('id')
      .eq('date', dateFormatee)
      .order('order_index', { ascending: true }) // <-- Trié par ordre d'affichage
      
    if (data) {
      const listeMaj = [...exercices]
      data.forEach((d, i) => { if(listeMaj[i]) listeMaj[i].id = d.id })
      setExercices(listeMaj)
    }
  }
  // SAUVEGARDE SPÉCIFIQUE POUR LES JOURS DE REPOS (Uniquement les métriques)
  const handleSaveMetricsOnly = async () => {
    setLoading(true)
    const payload = {
      date: dateFormatee,
      exercise_name: 'Repos',
      fatigue_score: fatigue,
      sleep_hours: sommeil,
      steps_count: pas
    }
    
    const { data } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee).limit(1)

    if (data && data.length > 0) {
      await supabase.from('workout_sets').update(payload).eq('id', data[0].id)
    } else {
      await supabase.from('workout_sets').insert([payload])
    }

    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // --- VUE JOUR DE REPOS ---
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

        {/* MÉTRIQUES AFFICHÉES MÊME LE JOUR DE REPOS */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <h3 className="text-sm font-bold text-slate-400 mb-4">Suivi quotidien</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col w-full"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Battery className="size-3 text-red-500"/> Fatigue</span><input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(parseInt(e.target.value))} className="w-full accent-red-500" /></div><span className="text-lg font-bold ml-4 text-white w-6 text-right">{fatigue}</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Moon className="size-3 text-indigo-400"/> Sommeil</span><input type="number" step="0.5" value={sommeil} onChange={(e) => setSommeil(parseFloat(e.target.value))} className="w-16 bg-transparent text-lg font-bold text-white outline-none" /></div><span className="text-xs text-slate-500">h</span></div>
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"><div className="flex flex-col"><span className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Footprints className="size-3 text-orange-400"/> Pas</span><input type="number" value={pas} onChange={(e) => setPas(parseInt(e.target.value))} className="w-full bg-transparent text-lg font-bold text-white outline-none" /></div></div>
          </div>
        </div>

        <button onClick={handleSaveMetricsOnly} disabled={loading} className={cn("w-full p-4 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg", saved ? "bg-emerald-600 shadow-emerald-500/25 text-white" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 text-white")}>
          {loading ? 'Enregistrement en cours...' : saved ? <><Check className="size-5" /> Suivi Mémorisé !</> : 'Enregistrer le suivi'}
        </button>
      </div>
    )
  }

  // --- VUE JOUR D'ENTRAÎNEMENT NORMALE ---
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
          <div key={exIndex} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4 relative group shadow-sm">
            
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 text-slate-400 px-3 py-1 rounded-md text-sm font-bold">{exIndex + 1}</div>
              <input 
                list={`liste-exos-${jourSemaine}`}
                placeholder="Nom de l'exercice..." 
                className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-blue-500 font-medium placeholder:text-slate-600"
                value={ex.name} 
                onChange={(e) => updateExerciceNom(exIndex, e.target.value)} 
              />
              <datalist id={`liste-exos-${jourSemaine}`}>
                {suggestionsDuJour.map(nomExo => <option key={nomExo} value={nomExo} />)}
              </datalist>
              <button onClick={() => supprimerExercice(exIndex, ex.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                <Trash2 className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col h-full">
                <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Target className="size-3" /> Prescription Coach</h3>
                
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
                  <div className="w-6"></div>
                  <div className="text-[10px] text-slate-500 uppercase text-center">Reps</div>
                  <div className="text-[10px] text-slate-500 uppercase text-center">Poids</div>
                  <div className="text-[10px] text-slate-500 uppercase text-center">RPE</div>
                  <div className="w-6"></div>
                </div>

                <div className="space-y-2 flex-1">
                  {ex.coachTracking.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                      <span className="w-6 text-xs font-bold text-slate-600 text-center">S{setIndex + 1}</span>
                      <input type="number" value={set.reps} onChange={(e) => updateSerieCoach(exIndex, setIndex, 'reps', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" />
                      <input type="number" value={set.weight} onChange={(e) => updateSerieCoach(exIndex, setIndex, 'weight', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" />
                      <input type="number" step="0.5" value={set.rpe} onChange={(e) => updateSerieCoach(exIndex, setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" />
                      <button onClick={() => supprimerSerieCoach(exIndex, setIndex)} className="w-6 flex justify-center text-slate-700 hover:text-red-400 transition-colors">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={() => ajouterSerieCoach(exIndex)} className="mt-3 w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <Plus className="size-3" /> Ajouter une série prévue
                </button>
              </div>

              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col h-full">
                <h3 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Check className="size-3" /> Validé</h3>
                
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
                  <div className="w-6"></div>
                  <div className="text-[10px] text-blue-500/70 uppercase text-center">Reps</div>
                  <div className="text-[10px] text-blue-500/70 uppercase text-center">Poids</div>
                  <div className="text-[10px] text-blue-500/70 uppercase text-center">RPE</div>
                  <div className="w-6"></div>
                </div>

                <div className="space-y-2 flex-1">
                  {ex.tracking.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                      <span className="w-6 text-xs font-bold text-slate-500 text-center">S{setIndex + 1}</span>
                      <input type="number" value={set.reps} onChange={(e) => updateSerieAthlete(exIndex, setIndex, 'reps', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                      <input type="number" value={set.weight} onChange={(e) => updateSerieAthlete(exIndex, setIndex, 'weight', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                      <input type="number" step="0.5" value={set.rpe} onChange={(e) => updateSerieAthlete(exIndex, setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                      <button onClick={() => supprimerSerieAthlete(exIndex, setIndex)} className="w-6 flex justify-center text-slate-600 hover:text-red-400 transition-colors">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={() => ajouterSerieAthlete(exIndex)} className="mt-3 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <Plus className="size-3" /> Série extra (Athlète)
                </button>
              </div>
            </div>

            <div className="mt-2 pt-3 border-t border-slate-800/50">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <MessageSquare className="size-4" /> 
                <span className="text-[10px] font-bold uppercase tracking-wider">Notes & Tempo</span>
              </div>
              <input 
                placeholder="Ex: Tempo 3-1-0, douleur épaule..." 
                value={ex.comments} 
                onChange={(e) => updateExerciceCommentaire(exIndex, e.target.value)} 
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