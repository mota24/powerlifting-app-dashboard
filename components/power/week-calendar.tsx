'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'

interface WeekCalendarProps {
  dateActive: Date;
  setDateActive: (date: Date) => void;
  blockTitle?: string;
  isRestDayMode?: boolean;
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

export function WeekCalendar({ dateActive, setDateActive, blockTitle, isRestDayMode = false }: WeekCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Ouverture EXPLICITE du sélecteur natif au premier tap. L'ancien pattern
  // (input date invisible étiré au-dessus du bouton) était capricieux sur
  // mobile : le tap focusait l'input sans ouvrir le calendrier.
  const ouvrirCalendrier = () => {
    const input = dateInputRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      // Navigateurs sans showPicker() : le clic direct sur l'input fait office de repli
      input.click()
    }
  }

  // Auto-scroll vers le jour sélectionné
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [dateActive]);

  const changerSemaine = (jours: number) => {
    const nouvelleDate = new Date(dateActive)
    nouvelleDate.setDate(nouvelleDate.getDate() + jours)
    setDateActive(nouvelleDate)
  }

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
  const localDateFormatee = new Date(dateActive.getTime() - (dateActive.getTimezoneOffset() * 60000)).toISOString().split('T')[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* Toute la surface du bouton est cliquable ; le onClick vit sur le
            parent et les enfants (icône SVG + texte) sont neutralisés en
            pointer-events-none pour ne jamais intercepter le tap. */}
        <button
          type="button"
          onClick={ouvrirCalendrier}
          className="relative flex items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-slate-800/60 active:bg-slate-800 transition-colors text-left min-h-11"
        >
          {/* Input natif : simple ancre du sélecteur, plus jamais une cible de clic */}
          <input
            ref={dateInputRef}
            type="date"
            value={localDateFormatee}
            onChange={(e) => { if (e.target.value) setDateActive(new Date(e.target.value)) }}
            className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
          <Calendar className="size-5 text-blue-500 pointer-events-none shrink-0" />
          <span className="text-lg font-bold text-slate-200 pointer-events-none">{blockTitle || "Calendrier"}</span>
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => changerSemaine(-7)} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"><ChevronLeft className="size-5"/></button>
          <button onClick={() => changerSemaine(7)} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"><ChevronRight className="size-5"/></button>
        </div>
      </div>

      {/* ZONE DÉFILANTE HORIZONTALE */}
      <div 
        ref={scrollRef}
        className="flex border-b border-slate-800 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {joursSemaine.map((dateObj, index) => {
          const estSelectionne = dateActive.toDateString() === dateObj.toDateString()
          const infoJour = WEEK_PROGRAM.find(p => p.id === dateObj.getDay())
          
          return (
            <button
              key={index}
              data-active={estSelectionne}
              onClick={() => setDateActive(dateObj)}
              className={cn(
                "px-5 py-3 flex flex-col items-center min-w-[3.5rem] text-sm font-medium transition-colors whitespace-nowrap border-b-2",
                estSelectionne
                  ? (isRestDayMode ? "border-emerald-500 text-emerald-400" : "border-blue-500 text-blue-400")
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
              )}
            >
              <span className="text-xs uppercase">{infoJour?.dayName}</span>
              <span className={cn("text-lg", estSelectionne ? "text-white" : "")}>{dateObj.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}