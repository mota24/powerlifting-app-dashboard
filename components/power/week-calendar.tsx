'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'

interface WeekCalendarProps {
  dateActive: Date;
  setDateActive: (date: Date) => void;
  blockTitle?: string;
  /** Semaines avant la prochaine compétition (0 = semaine du jour J), null si aucune compétition à venir. */
  weeksOut?: number | null;
}

const WEEK_PROGRAM = [
  { id: 1, dayName: 'Lun' }, { id: 2, dayName: 'Mar' }, { id: 3, dayName: 'Mer' },
  { id: 4, dayName: 'Jeu' }, { id: 5, dayName: 'Ven' }, { id: 6, dayName: 'Sam' }, { id: 0, dayName: 'Dim' }, 
]

export function WeekCalendar({ dateActive, setDateActive, blockTitle, weeksOut }: WeekCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const ouvrirCalendrier = () => {
    const input = dateInputRef.current
    if (!input) return
    try { input.showPicker() } catch { input.click() }
  }

  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
        {/* min-w-0 sur le bouton et truncate sur le titre : le badge S-X
            allonge cette ligne, min-width:auto (implicite en flex) la ferait
            sinon déborder au lieu de laisser le titre se tronquer. */}
        <button type="button" onClick={ouvrirCalendrier} className="relative flex min-w-0 items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-zinc-900 active:bg-zinc-800 transition-colors text-left min-h-11">
          <input ref={dateInputRef} type="date" value={localDateFormatee} onChange={(e) => { if (e.target.value) setDateActive(new Date(e.target.value)) }} className="absolute inset-0 h-full w-full opacity-0 pointer-events-none" tabIndex={-1} aria-hidden="true" />
          <Calendar className="size-4 text-white pointer-events-none shrink-0" />
          <span className="min-w-0 truncate text-sm font-bold uppercase tracking-widest text-white pointer-events-none">{blockTitle || "CALENDRIER"}</span>
          {weeksOut != null && (
            <span className="shrink-0 pointer-events-none rounded-md bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-orange-500">
              {weeksOut > 0 ? `S-${weeksOut}` : 'S0'}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => changerSemaine(-7)} className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"><ChevronLeft className="size-4"/></button>
          <button onClick={() => changerSemaine(7)} className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"><ChevronRight className="size-4"/></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex border-b border-zinc-900 overflow-x-auto pb-2 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {joursSemaine.map((dateObj, index) => {
          const estSelectionne = dateActive.toDateString() === dateObj.toDateString()
          const infoJour = WEEK_PROGRAM.find(p => p.id === dateObj.getDay())
          
          return (
            <button
              key={index}
              data-active={estSelectionne}
              onClick={() => setDateActive(dateObj)}
              className={cn(
                "px-5 py-3 flex flex-col items-center min-w-[3.5rem] transition-colors whitespace-nowrap border-b-2",
                estSelectionne
                  ? "border-white text-white"
                  : "border-transparent text-zinc-600 hover:text-zinc-300 hover:border-zinc-800"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{infoJour?.dayName}</span>
              <span className={cn("text-xl font-black tabular-nums", estSelectionne ? "text-white" : "")}>{dateObj.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}