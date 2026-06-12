'use client'

import { useState } from 'react'
import { computePlates, BAR_WEIGHT } from '@/lib/powerlifting'
import { Card, CardTitle } from './card'
import { Dumbbell } from 'lucide-react'

export function PlateVisualizer() {
  const [target, setTarget] = useState(167.5)
  const { plates, perSide, achievable, remainder } = computePlates(target)

  return (
    <Card>
      <CardTitle
        icon={Dumbbell}
        title="Plate Math Visualizer"
        hint="Disques par côté d'une barre de 20 kg"
      />

      <div className="mb-4 flex items-end gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">
            Poids cible (kg)
          </span>
          <input
            type="number"
            step={2.5}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 font-mono text-lg text-foreground outline-none focus:border-primary"
          />
        </label>
        <div className="text-right">
          <span className="block text-xs text-muted-foreground">Par côté</span>
          <span className="font-mono text-lg font-semibold text-primary">
            {perSide > 0 ? perSide : 0} kg
          </span>
        </div>
      </div>

      {/* Barre visuelle */}
      <div className="flex items-center justify-center gap-1 overflow-x-auto rounded-xl bg-secondary/60 py-6">
        {/* Disques côté gauche (miroir) */}
        <div className="flex flex-row-reverse items-center gap-0.5">
          {plates.map((p, i) => (
            <PlateDisc key={`l-${i}`} plate={p} />
          ))}
        </div>
        {/* Manchon + barre */}
        <div className="h-3 w-6 rounded-sm bg-muted-foreground/60" />
        <div className="h-2 w-10 bg-muted-foreground/40" />
        <div className="flex flex-col items-center px-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            20kg
          </span>
        </div>
        <div className="h-2 w-10 bg-muted-foreground/40" />
        <div className="h-3 w-6 rounded-sm bg-muted-foreground/60" />
        {/* Disques côté droit */}
        <div className="flex items-center gap-0.5">
          {plates.map((p, i) => (
            <PlateDisc key={`r-${i}`} plate={p} />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {plates.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            {target <= BAR_WEIGHT
              ? 'Barre seule (20 kg)'
              : 'Augmentez la charge'}
          </span>
        ) : (
          summarize(plates).map((s) => (
            <span
              key={s.label}
              className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-foreground"
            >
              {s.count} × {s.label} kg
            </span>
          ))
        )}
        {!achievable && remainder > 0 ? (
          <span className="rounded-md bg-destructive/20 px-2 py-1 text-xs text-destructive">
            Reste {remainder} kg non chargeable
          </span>
        ) : null}
      </div>
    </Card>
  )
}

function PlateDisc({
  plate,
}: {
  plate: { weight: number; color: string; label: string }
}) {
  // Hauteur proportionnelle au poids du disque
  const heights: Record<number, string> = {
    25: 'h-24',
    20: 'h-[5.5rem]',
    15: 'h-20',
    10: 'h-16',
    5: 'h-12',
    2.5: 'h-9',
    1.25: 'h-7',
  }
  const widths: Record<number, string> = {
    25: 'w-3.5',
    20: 'w-3.5',
    15: 'w-3',
    10: 'w-2.5',
    5: 'w-2.5',
    2.5: 'w-2',
    1.25: 'w-2',
  }
  return (
    <div
      className={`flex ${heights[plate.weight]} ${widths[plate.weight]} items-center justify-center rounded-sm border border-black/20 shadow-sm`}
      style={{ background: plate.color }}
      title={`${plate.label} kg`}
    >
      <span className="rotate-90 text-[8px] font-bold text-black/70">
        {plate.label}
      </span>
    </div>
  )
}

function summarize(plates: { label: string }[]) {
  const map = new Map<string, number>()
  for (const p of plates) map.set(p.label, (map.get(p.label) ?? 0) + 1)
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }))
}
