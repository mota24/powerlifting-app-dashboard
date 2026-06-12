import { Card, CardTitle } from './card'
import { CalendarDays, Moon, Dumbbell, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

type Day = {
  name: string
  short: string
  type: 'sbd' | 'training' | 'rest'
  label: string
}

const WEEK: Day[] = [
  { name: 'Lundi', short: 'Lun', type: 'training', label: 'Entraînement / Accessoires' },
  { name: 'Mardi', short: 'Mar', type: 'training', label: 'Entraînement / Accessoires' },
  { name: 'Mercredi', short: 'Mer', type: 'training', label: 'Entraînement / Accessoires' },
  { name: 'Jeudi', short: 'Jeu', type: 'training', label: 'Entraînement / Accessoires' },
  { name: 'Vendredi', short: 'Ven', type: 'rest', label: 'Repos' },
  { name: 'Samedi', short: 'Sam', type: 'sbd', label: 'Jour SBD (Squat, Bench, Deadlift)' },
  { name: 'Dimanche', short: 'Dim', type: 'rest', label: 'Repos' },
]

export function WeekCalendar() {
  return (
    <Card>
      <CardTitle
        icon={CalendarDays}
        title="Calendrier de la semaine"
        hint="Vue SBD"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {WEEK.map((day) => (
          <div
            key={day.name}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-3 transition-colors',
              day.type === 'sbd' &&
                'border-primary bg-primary/15 ring-1 ring-primary/40',
              day.type === 'training' && 'border-border bg-secondary/50',
              day.type === 'rest' && 'border-border/50 bg-muted/30 opacity-60',
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-sm font-bold',
                  day.type === 'sbd' ? 'text-primary' : 'text-foreground',
                )}
              >
                {day.short}
              </span>
              {day.type === 'sbd' && <Dumbbell className="size-4 text-primary" />}
              {day.type === 'training' && (
                <Activity className="size-4 text-muted-foreground" />
              )}
              {day.type === 'rest' && (
                <Moon className="size-4 text-muted-foreground" />
              )}
            </div>
            <p
              className={cn(
                'text-xs leading-snug text-pretty',
                day.type === 'sbd'
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {day.label}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
