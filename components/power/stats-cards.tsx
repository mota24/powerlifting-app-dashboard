import { epley1RM, roundToHalf } from '@/lib/powerlifting'
import { Card } from './card'
import { TrendingUp } from 'lucide-react'

// Simulation : dernière performance par mouvement
const LIFTS = [
  { name: 'Squat', weight: 180, reps: 3, color: 'var(--chart-1)' },
  { name: 'Bench', weight: 120, reps: 5, color: 'var(--chart-2)' },
  { name: 'Deadlift', weight: 220, reps: 2, color: 'var(--chart-3)' },
]

export function StatsCards() {
  const total = LIFTS.reduce(
    (acc, l) => acc + roundToHalf(epley1RM(l.weight, l.reps)),
    0,
  )

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {LIFTS.map((lift) => {
        const e1rm = roundToHalf(epley1RM(lift.weight, lift.reps))
        return (
          <Card key={lift.name} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                1RM {lift.name}
              </span>
              <span
                className="size-2.5 rounded-full"
                style={{ background: lift.color }}
              />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold text-foreground">
              {e1rm}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kg
              </span>
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {lift.weight}kg × {lift.reps}
            </p>
          </Card>
        )
      })}

      <Card className="flex flex-col justify-between bg-primary/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Total SBD</span>
          <TrendingUp className="size-4 text-primary" />
        </div>
        <p className="mt-2 font-mono text-3xl font-bold text-primary">
          {roundToHalf(total)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            kg
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Estimation Epley</p>
      </Card>
    </div>
  )
}
