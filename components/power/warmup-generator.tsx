'use client'

import { useState } from 'react'
import { generateWarmup } from '@/lib/powerlifting'
import { Card, CardTitle } from './card'
import { Flame } from 'lucide-react'

export function WarmupGenerator() {
  const [topSet, setTopSet] = useState(180)
  const steps = generateWarmup(topSet)

  return (
    <Card>
      <CardTitle
        icon={Flame}
        title="Générateur d'Échauffement"
        hint="Paliers progressifs vers le top set"
      />

      <label className="mb-4 block">
        <span className="mb-1 block text-xs text-muted-foreground">
          Top Set (kg)
        </span>
        <input
          type="number"
          step={2.5}
          value={topSet}
          onChange={(e) => setTopSet(Number(e.target.value) || 0)}
          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 font-mono text-lg text-foreground outline-none focus:border-primary"
        />
      </label>

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
              {i + 1}
            </span>
            <div className="flex-1">
              <span className="font-mono text-base font-semibold text-foreground">
                {s.weight} kg
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {s.label}
              </span>
            </div>
            <span className="font-mono text-sm text-muted-foreground">
              ×{s.reps}
            </span>
            <span className="w-10 text-right font-mono text-xs text-primary">
              {s.pct}%
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
