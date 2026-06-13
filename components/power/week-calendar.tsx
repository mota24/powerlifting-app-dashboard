'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface WeekCalendarProps {
  dateActive: Date;
  setDateActive: (date: Date) => void;
  blockTitle?: string;
}

const WEEK_PROGRAM = [
  { id: 1, dayName: 'Lun', title: 'Entraînement', desc: 'Squat / Bench ou Accessoires' },
  { id: 2, dayName: 'Mar', title: 'Entraînement', desc: 'Bench / Deadlift ou Accessoires' },
  { id: 3, dayName: 'Mer', title: 'Entraînement', desc: 'Squat / Bench ou Accessoires' },
  { id: 4, dayName: 'Jeu', title: 'Entraînement', desc: 'Bench ou Accessoires' },
  { id: 5, dayName: 'Ven', title: 'Repos', desc: 'Récupération active' },
  { id: 6, dayName: 'Sam', title: 'Jour SBD', desc: 'Squat + Bench + Deadlift (Priorité Intensité)' },
  { id: 0, dayName: 'Dim', title: 'Repos', desc: 'Récupération totale' }, 
]

export function WeekCalendar({ dateActive, setDateActive, blockTitle }: WeekCalendarProps) {
  
  // Fonction pour changer de semaine (boutons précédent/suivant)
  const changerSemaine = (jours: number) => {
    const nouvelleDate = new Date(dateActive)
    nouvelleDate.setDate(nouvelleDate.getDate() + jours)
    setDateActive(nouvelleDate)
  }

  // ALGORITHME CORRIGÉ : Calcul strict des jours de la semaine
  const getJoursDeLaSemaine = (date: Date) => {
    const jours = []
    const baseDate = new Date(date)
    
    // 1. On trouve le jour de la semaine (0 = Dimanche, 1 = Lundi...)
    const day = baseDate.getDay()
    
    // 2. On calcule l'écart pour remonter jusqu'au Lundi de cette semaine
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1) 
    
    // 3. On fixe fermement la date du Lundi (sans la muter dans la boucle)
    const lundi = new Date(baseDate.setDate(diff))
    
    // 4. On génère proprement les 7 jours suivants
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundi) // On repart d'une copie vierge du Lundi
      d.setDate(lundi.getDate() + i) // On ajoute juste +1, +2, +3...
      jours.push(d)
    }
    return jours
  }

  const joursSemaine = getJoursDeLaSemaine(dateActive)
  const jourSelectionneInfo = WEEK_PROGRAM.find(p => p.id === dateActive.getDay()) || WEEK_PROGRAM[0]

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-blue-500" />
          <h2 className="text-lg font-bold text-slate-200">
            {blockTitle || "Calendrier"} 
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changerSemaine(-7)} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"><ChevronLeft className="size-5"/></button>
          <button onClick={() => changerSemaine(7)} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"><ChevronRight className="size-5"/></button>
        </div>
      </div>

      {/* Onglets des jours */}
      <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none">
        {joursSemaine.map((dateObj, index) => {
          const estSelectionne = dateActive.toDateString() === dateObj.toDateString()
          const infoJour = WEEK_PROGRAM.find(p => p.id === dateObj.getDay())
          
          return (
            <button
              key={index}
              onClick={() => setDateActive(dateObj)}
              className={cn(
                "px-4 py-3 flex flex-col items-center min-w-[4rem] text-sm font-medium transition-colors whitespace-nowrap border-b-2",
                estSelectionne
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
              )}
            >
              <span className="text-xs uppercase">{infoJour?.dayName}</span>
              <span className={cn("text-lg", estSelectionne ? "text-white" : "")}>{dateObj.getDate()}</span>
            </button>
          )
        })}
      </div>

      {/* Description du jour */}
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
        <h3 className="font-bold text-slate-200">{jourSelectionneInfo.title}</h3>
        <p className="text-sm text-slate-400 mt-1">{jourSelectionneInfo.desc}</p>
      </div>
    </div>
  )
}