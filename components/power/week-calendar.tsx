'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'
import { useLocale } from '@/app/ThemeContext'

interface WeekCalendarProps {
  dateActive: Date;
  setDateActive: (date: Date) => void;
  blockTitle?: string;
  weeksOut?: number | null;
}


export function WeekCalendar({ dateActive, setDateActive, blockTitle, weeksOut }: WeekCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Les abréviations de jours viennent de la locale du profil plutôt que
  // d'une liste figée en français.
  const locale = useLocale();

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
        <label className="relative flex min-w-0 cursor-pointer items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-accent active:bg-secondary transition-colors text-left min-h-11">
          <input type="date" value={localDateFormatee} onChange={(e) => { if (e.target.value) setDateActive(new Date(e.target.value)) }} className="absolute inset-0 h-full w-full opacity-0" tabIndex={-1} aria-hidden="true" />
          <Calendar className="size-4 text-foreground pointer-events-none shrink-0" />
          <span className="min-w-0 truncate text-sm font-bold uppercase tracking-widest text-foreground pointer-events-none">
            {blockTitle || "CALENDRIER"}
            {weeksOut != null && ` | ${weeksOut > 0 ? `S-${weeksOut}` : 'S0'}`}
          </span>
        </label>

        <div className="flex items-center gap-1">
          <button onClick={() => changerSemaine(-7)} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="size-4"/></button>
          <button onClick={() => changerSemaine(7)} className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="size-4"/></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex border-b border-border overflow-x-auto pb-2 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {joursSemaine.map((dateObj, index) => {
          const estSelectionne = dateActive.toDateString() === dateObj.toDateString()
          
          return (
            <button
              key={index}
              data-active={estSelectionne}
              onClick={() => setDateActive(dateObj)}
              className={cn(
                "px-5 py-3 flex flex-col items-center min-w-[3.5rem] transition-colors whitespace-nowrap border-b-2",
                estSelectionne
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{dateObj.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}</span>
              <span className={cn("text-xl font-black tabular-nums", estSelectionne ? "text-primary" : "")}>{dateObj.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}