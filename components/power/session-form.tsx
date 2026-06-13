'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, Activity, Check, Moon, Footprints, Battery, Coffee, Plus, Trash2, MessageSquare, X, Copy, RefreshCw, Award, Zap, Flame } from 'lucide-react'
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
  const [exercices, setExercices] = useState<ExerciceRow[]>([])
  const [fatigue, setFatigue] = useState(5)
  const [sommeil, setSommeil] = useState(8)
  const [pas, setPas] = useState(8000)

  // Auto-Save
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const isInitialLoad = useRef(true)

  // XP & Modal de Fin de mission
  const [showModal, setShowModal] = useState(false)
  const [xpGained, setXpGained] = useState(0)
  const [newStreakState, setNewStreakState] = useState(0)
  const [leveledUp, setLeveledUp] = useState(false)

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
    isInitialLoad.current = true;
    setIsAutoSaving(false);

    const chargerSeance = async () => {
      const { data } = await supabase.from('workout_sets').select('*').eq('date', dateFormatee).order('created_at', { ascending: true })

      if (data && data.length > 0) {
        const derniereLigne = data[data.length - 1];
        const vraisExercices = data.filter((item: any) => item.exercise_name !== 'Repos' && item.exercise_name !== 'Jour de Repos');
        vraisExercices.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));

        if (vraisExercices.length > 0) {
          const listeExercices = vraisExercices.map((item: any) => {
            const fallbackCoachTracking = item.coach_reps ? [{ reps: item.coach_reps.toString(), weight: item.coach_weight?.toString() || '', rpe: item.coach_rpe?.toString() || '' }] : [{ reps: '', weight: '', rpe: '' }];
            const savedCoachTracking = item.coach_tracking_data ? item.coach_tracking_data : fallbackCoachTracking;
            let savedTracking = item.tracking_data ? [...item.tracking_data] : [{ reps: '', weight: '', rpe: '' }];

            if (savedTracking.length < savedCoachTracking.length) {
              const lignesManquantes = savedCoachTracking.length - savedTracking.length;
              for (let i = 0; i < lignesManquantes; i++) { savedTracking.push({ reps: '', weight: '', rpe: '' }); }
            }

            return { id: item.id, name: item.exercise_name || '', coachTracking: savedCoachTracking, tracking: savedTracking, comments: item.comments || '' }
          });
          setExercices(listeExercices);
        } else {
          setExercices([creerExerciceVierge()]);
        }

        setFatigue(derniereLigne.fatigue_score || 5);
        setSommeil(derniereLigne.sleep_hours || 8);
        setPas(derniereLigne.steps_count || 0);

      } else {
        setExercices([creerExerciceVierge()]); setFatigue(5); setSommeil(8); setPas(0);
      }
      setTimeout(() => { isInitialLoad.current = false; }, 500);
    };
    chargerSeance();
  }, [dateActive, dateFormatee]);

  const executerSauvegarde = async () => {
    if (jourSemaine === 0 || jourSemaine === 5) {
      const payload = { date: dateFormatee, exercise_name: 'Repos', fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas }
      const { data } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee).limit(1)
      if (data && data.length > 0) await supabase.from('workout_sets').update(payload).eq('id', data[0].id)
      else await supabase.from('workout_sets').insert([payload])
      return;
    }

    const promesses = exercices.map((ex, index) => {
      const payload = { date: dateFormatee, exercise_name: ex.name || 'Exercice Non Défini', coach_tracking_data: ex.coachTracking, tracking_data: ex.tracking, comments: ex.comments || null, fatigue_score: fatigue, sleep_hours: sommeil, steps_count: pas, order_index: index }
      if (ex.id) return supabase.from('workout_sets').update(payload).eq('id', ex.id)
      else return supabase.from('workout_sets').insert([payload])
    })
    await Promise.all(promesses)
    
    const { data } = await supabase.from('workout_sets').select('id').eq('date', dateFormatee).order('order_index', { ascending: true }) 
    if (data) {
      setExercices(prev => {
        const newEx = [...prev];
        data.forEach((d: any, i: number) => { if (newEx[i]) newEx[i].id = d.id });
        return newEx;
      });
    }
  }

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (exercices.length === 0 && (jourSemaine !== 0 && jourSemaine !== 5)) return;

    const timeoutId = setTimeout(async () => {
      setIsAutoSaving(true);
      await executerSauvegarde();
      setIsAutoSaving(false);
      setLastSaved(new Date());
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [exercices, fatigue, sommeil, pas]);

  // ==========================================
  // SYSTÈME DE VALIDATION (PRESTIGE & XP)
  // ==========================================
  const validerMission = async () => {
    setIsAutoSaving(true);
    await executerSauvegarde(); // Sécurité : on sauvegarde avant de valider

    try {
      // 1. Récupération des données du joueur
      const { data: progress } = await supabase.from('user_progress').select('*').limit(1).single();
      if (!progress) throw new Error("Profil joueur introuvable");

      // 2. Vérification si la mission est déjà validée
      if (progress.last_completed_date === dateFormatee) {
        alert("Tu as déjà validé ta mission pour cette journée !");
        setIsAutoSaving(false);
        return;
      }

      // 3. Calcul du Streak (Série)
      let currentStreak = progress.streak_days || 0;
      let newStreak = currentStreak;
      
      const today = new Date(dateFormatee);
      const lastDate = progress.last_completed_date ? new Date(progress.last_completed_date) : null;

      if (lastDate) {
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          // Streak Gelé : Vérifie si les jours ratés étaient UNIQUEMENT des jours de repos (0: Dimanche, 5: Vendredi)
          let brokeStreak = false;
          for (let i = 1; i < diffDays; i++) {
            const missingDate = new Date(lastDate);
            missingDate.setDate(missingDate.getDate() + i);
            const missingDay = missingDate.getDay();
            if (missingDay !== 0 && missingDay !== 5) {
              brokeStreak = true; break; // Un jour d'entraînement a été raté !
            }
          }
          if (brokeStreak) newStreak = 1; // Punition
          else newStreak += 1; // Gelé et continué
        }
      } else {
        newStreak = 1; // Premier jour
      }

      // 4. Calcul de l'XP de base
      let baseXP = 0;
      if (jourSemaine === 0 || jourSemaine === 5) {
        baseXP = 50; // Jours de repos trackés
      } else {
        baseXP += 50; // Présence
        if (pas >= 8000) baseXP += 25;
        if (sommeil >= 7.5) baseXP += 25;
        
        const hasMainLifts = exercices.some(ex => LIFT_SQUAT.includes(ex.name) || LIFT_BENCH.includes(ex.name) || LIFT_DEADLIFT.includes(ex.name));
        if (hasMainLifts) baseXP += 50;
        
        const hasAccessories = exercices.some(ex => ACCESSORIES.includes(ex.name));
        if (hasAccessories) baseXP += 50;
      }

      // 5. Multiplicateur de Streak
      let multiplier = 1;
      if (newStreak >= 7) multiplier = 1.5;
      else if (newStreak >= 5) multiplier = 1.25;
      else if (newStreak >= 3) multiplier = 1.1;

      const finalXP = Math.round(baseXP * multiplier);

      // 6. Gestion du Level Up
      let newLevel = progress.level;
      let newCurrentXP = progress.current_xp + finalXP;
      let newTotalXP = progress.total_xp + finalXP;
      let xpNeeded = newLevel * 1000;
      let aLevelUp = false;

      while (newCurrentXP >= xpNeeded) {
        newCurrentXP -= xpNeeded;
        newLevel += 1;
        xpNeeded = newLevel * 1000;
        aLevelUp = true;
      }

      // 7. Enregistrement en base de données
      await supabase.from('user_progress').update({
        level: newLevel,
        current_xp: newCurrentXP,
        total_xp: newTotalXP,
        streak_days: newStreak,
        last_completed_date: dateFormatee
      }).eq('id', progress.id);

      // 8. Affichage du pop-up
      setXpGained(finalXP);
      setNewStreakState(newStreak);
      setLeveledUp(aLevelUp);
      setShowModal(true);

    } catch (e: any) {
      alert("Erreur lors de la validation : " + e.message);
    } finally {
      setIsAutoSaving(false);
    }
  }

  // Fonctions Exercices (ajouter/supprimer)
  const creerExerciceVierge = (): ExerciceRow => ({ id: null, name: '', coachTracking: [{ reps: '', weight: '', rpe: '' }], tracking: [{ reps: '', weight: '', rpe: '' }], comments: '' })
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
    if (nouvelleListe[exIndex].tracking.length > nouvelleListe[exIndex].coachTracking.length) { nouvelleListe[exIndex].tracking.splice(setIndex, 1) }
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

  // --- RENDU UI JOUR DE REPOS ---
  if (jourSemaine === 0 || jourSemaine === 5) {
    return (
      <div className="space-y-6 animate-in fade-in pb-10">
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/30 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-full"><Coffee className="size-8 text-slate-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-200">Jour de Repos</h2>
            <p className="text-sm text-slate-500 mt-1">Maintiens ton Streak en loggant ton suivi quotidien !</p>
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

        {/* Bouton de Validation de Mission */}
        <button 
          onClick={validerMission} 
          disabled={isAutoSaving} 
          className="w-full p-4 rounded-xl font-black text-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex justify-center items-center gap-2"
        >
          {isAutoSaving ? <><RefreshCw className="size-5 animate-spin" /> SAUVEGARDE...</> : <><Award className="size-6" /> VALIDER LE REPOS & GAGNER XP</>}
        </button>
        {ModalGagnant()}
      </div>
    )
  }

  const suggestionsDuJour = getExercicesDuJour()

  // --- RENDU UI JOUR D'ENTRAÎNEMENT ---
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
                  <div className="w-6"></div><div className="text-[10px] text-slate-500 uppercase text-center">Reps</div><div className="text-[10px] text-slate-500 uppercase text-center">Poids</div><div className="text-[10px] text-slate-500 uppercase text-center">RPE</div><div className="w-6"></div>
                </div>
                <div className="space-y-2 flex-1">
                  {ex.coachTracking.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                      <span className="w-6 text-xs font-bold text-slate-600 text-center">S{setIndex + 1}</span>
                      <input type="number" value={set.reps} onChange={(e) => updateSerieCoach(exIndex, setIndex, 'reps', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" />
                      <input type="number" value={set.weight} onChange={(e) => updateSerieCoach(exIndex, setIndex, 'weight', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" />
                      <input type="number" step="0.5" value={set.rpe} onChange={(e) => updateSerieCoach(exIndex, setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-slate-950 border border-slate-800 rounded-md text-slate-300 text-center outline-none focus:border-slate-500" />
                      <button onClick={() => supprimerSerieCoach(exIndex, setIndex)} className="w-6 flex justify-center text-slate-700 hover:text-red-400 transition-colors"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => ajouterSerieCoach(exIndex)} className="mt-3 w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"><Plus className="size-3" /> Ajouter une série prévue</button>
              </div>

              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col h-full">
                <h3 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Check className="size-3" /> Validé</h3>
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
                  <div className="w-6"></div><div className="text-[10px] text-blue-500/70 uppercase text-center">Reps</div><div className="text-[10px] text-blue-500/70 uppercase text-center">Poids</div><div className="text-[10px] text-blue-500/70 uppercase text-center">RPE</div><div className="w-6"></div>
                </div>
                <div className="space-y-2 flex-1">
                  {ex.tracking.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                      <span className="w-6 text-xs font-bold text-slate-500 text-center">S{setIndex + 1}</span>
                      <input type="number" value={set.reps} onChange={(e) => updateSerieAthlete(exIndex, setIndex, 'reps', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                      <input type="number" value={set.weight} onChange={(e) => updateSerieAthlete(exIndex, setIndex, 'weight', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                      <input type="number" step="0.5" value={set.rpe} onChange={(e) => updateSerieAthlete(exIndex, setIndex, 'rpe', e.target.value)} className="w-full p-2 bg-slate-950 border border-blue-500/30 rounded-md text-white text-center outline-none focus:border-blue-500" />
                      <button onClick={() => supprimerSerieAthlete(exIndex, setIndex)} className="w-6 flex justify-center text-slate-600 hover:text-red-400 transition-colors"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => ajouterSerieAthlete(exIndex)} className="mt-3 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"><Plus className="size-3" /> Série extra (Athlète)</button>
              </div>
            </div>
            <div className="mt-2 pt-3 border-t border-slate-800/50">
              <div className="flex items-center gap-2 mb-2 text-slate-400"><MessageSquare className="size-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Notes & Tempo</span></div>
              <input placeholder="Ex: Tempo 3-1-0, douleur épaule..." value={ex.comments} onChange={(e) => updateExerciceCommentaire(exIndex, e.target.value)} className="w-full p-2 bg-transparent border border-slate-800 rounded-md text-sm text-slate-300 outline-none focus:border-blue-500" />
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

      <div className="space-y-4 pt-4 border-t border-slate-800">
        {/* Autosave discret */}
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
          {isAutoSaving ? <><RefreshCw className="size-3 animate-spin" /> Synchronisation en cours...</> : <><Check className="size-3 text-emerald-500" /> Sécurisé {lastSaved ? `à ${lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ''}</>}
        </div>

        {/* Le gros bouton de fin de mission */}
        <button 
          onClick={validerMission} 
          disabled={isAutoSaving} 
          className="w-full p-5 rounded-xl font-black text-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex justify-center items-center gap-2"
        >
          {isAutoSaving ? <><RefreshCw className="size-5 animate-spin" /> PATIENTEZ...</> : <><Award className="size-6" /> FIN DE SÉANCE - VALIDER LA MISSION</>}
        </button>
      </div>

      {ModalGagnant()}
    </div>
  )

  function ModalGagnant() {
    if (!showModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <Award className="size-8" />
            </div>
            <h2 className="text-2xl font-black text-white">MISSION ACCOMPLIE</h2>
            <p className="text-slate-400">Excellente discipline. Sécurise tes gains.</p>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 space-y-3 border border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Zap className="size-4 text-yellow-400"/> XP Gagné</span>
              <span className="text-xl font-black text-yellow-400">+{xpGained} XP</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Flame className="size-4 text-orange-500"/> Série en cours</span>
              <span className="text-lg font-bold text-orange-500">{newStreakState} Jours</span>
            </div>
          </div>

          {leveledUp && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-center font-bold text-sm">
              🌟 FÉLICITATIONS, TU AS GAGNÉ UN NIVEAU ! 🌟
            </div>
          )}

          <button onClick={() => setShowModal(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">
            Fermer le rapport
          </button>
        </div>
      </div>
    )
  }
}