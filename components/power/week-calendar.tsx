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

  // ALGORITHME : Calcul strict des jours de la semaine
  const getJoursDeLaSemaine = (date: Date) => {
    const jours = []
    const baseDate = new Date(date)
    const day = baseDate.getDay()
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1) 
    const lundi = new Date(baseDate.setDate(diff))
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundi)
      d.setDate(lundi.getDate() + i)
      jours.push(d)
    }
    return jours
  }

  const joursSemaine = getJoursDeLaSemaine(dateActive)
  const jourSelectionneInfo = WEEK_PROGRAM.find(p => p.id === dateActive.getDay()) || WEEK_PROGRAM[0]

  // Formatage de la date locale pour l'input natif (ex: "2024-05-15")
  const localDateFormatee = new Date(dateActive.getTime() - (dateActive.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  return (
    <div className="space-y-4">
      {/* En-tête avec Navigation */}
      <div className="flex items-center justify-between">
        
        {/* LA ZONE CLICABLE POUR LE CALENDRIER NATIF */}
        <div className="relative flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity">
          {/* L'input invisible qui déclenche le calendrier du téléphone/PC */}
          <input 
            type="date"
            value={localDateFormatee}
            onChange={(e) => {
              if (e.target.value) {
                setDateActive(new Date(e.target.value))
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            title="Choisir une date spécifique"
          />
          
          {/* Le visuel que l'utilisateur voit */}
          <Calendar className="size-5 text-blue-500 relative z-0" />
          <h2 className="text-lg font-bold text-slate-200 relative z-0">
            {blockTitle || "Calendrier"} 
          </h2>
        </div>

        {/* Flèches pour naviguer semaine par semaine */}
        <div className="flex items-center gap-2 relative z-20">
          <button onClick={() => changerSemaine(-7)} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"><ChevronLeft className="size-5"/></button>
          <button onClick={() => changerSemaine(7)} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"><ChevronRight className="size-5"/></button>
        </div>
      </div>

      {/* Onglets des jours (LUN, MAR, MER...) */}
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