'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// On passe les props depuis le cerveau (page.tsx)
interface Props {
  dateActive: Date;
  setDateActive: (date: Date) => void;
}

const WEEK_PROGRAM = [
  { id: 1, dayName: 'Lun', title: 'Entraînement', desc: 'Squat / Bench ou Accessoires' },
  { id: 2, dayName: 'Mar', title: 'Entraînement', desc: 'Bench / Deadlift ou Accessoires' },
  { id: 3, dayName: 'Mer', title: 'Entraînement', desc: 'Squat / Bench ou Accessoires' },
  { id: 4, dayName: 'Jeu', title: 'Entraînement', desc: 'Bench ou Accessoires' },
  { id: 5, dayName: 'Ven', title: 'Repos', desc: 'Récupération active' },
  { id: 6, dayName: 'Sam', title: 'Jour SBD', desc: 'Squat + Bench + Deadlift (Priorité Intensité)' },
  { id: 0, dayName: 'Dim', title: 'Repos', desc: 'Récupération totale' }, // JS : Dimanche = 0
]

// Date de début de ton Bloc (À modifier selon ton vrai programme)
const BLOCK_START_DATE = new Date('2026-06-01')

export function WeekCalendar({ dateActive, setDateActive }: Props) {
  
  // Fonction pour changer de semaine
  const changerSemaine = (jours: number) => {
    const nouvelleDate = new Date(dateActive)
    nouvelleDate.setDate(nouvelleDate.getDate() + jours)
    setDateActive(nouvelleDate)
  }

  // Calcul mathématique des jours de la semaine affichée
  const getJoursDeLaSemaine = (date: Date) => {
    const jours = []
    const jourActuel = new Date(date)
    const premierJour = jourActuel.getDate() - jourActuel.getDay() + (jourActuel.getDay() === 0 ? -6 : 1) // Lundi
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(jourActuel.setDate(premierJour + i))
      jours.push(d)
    }
    return jours
  }

  const joursSemaine = getJoursDeLaSemaine(dateActive)
  const jourSelectionneInfo = WEEK_PROGRAM.find(p => p.id === dateActive.getDay()) || WEEK_PROGRAM[0]

  // Calcul du Bloc (Semaine X / 5)
  const diffTime = Math.abs(dateActive.getTime() - BLOCK_START_DATE.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const numeroSemaine = Math.max(1, Math.ceil((diffDays + 1) / 7)) // Evite semaine 0

  return (
    <div className="space-y-4">
      {/* En-tête : Calcul de la semaine du bloc */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-blue-500" />
          <h2 className="text-lg font-bold text-slate-200">
            Bloc 1 <span className="text-slate-500 font-normal">| Semaine {numeroSemaine} / 5</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changerSemaine(-7)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><ChevronLeft className="size-5"/></button>
          <button onClick={() => changerSemaine(7)} className="p-1 hover:bg-slate-800 rounded text-slate-400"><ChevronRight className="size-5"/></button>
        </div>
      </div>

      {/* Onglets épurés (Design que tu préfères) */}
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

      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
        <h3 className="font-bold text-slate-200">{jourSelectionneInfo.title}</h3>
        <p className="text-sm text-slate-400 mt-1">{jourSelectionneInfo.desc}</p>
      </div>
    </div>
  )
}