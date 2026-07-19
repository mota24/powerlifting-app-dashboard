'use client'

import { useState } from 'react'
import { computePlates, BAR_WEIGHT } from '@/lib/powerlifting'
import { Dumbbell } from 'lucide-react'

export function PlateVisualizer() {
  const [target, setTarget] = useState(167.5)
  const { plates, perSide, achievable, remainder } = computePlates(target)

  return (
    <div className="p-6 sm:p-8 bg-zinc-950 border border-zinc-900 rounded-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Dumbbell className="size-5 text-white" />
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Plate Math</h2>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Disques par côté</span>
        </div>
      </div>

      <div className="mb-8 flex items-end gap-4">
        <label className="flex-1">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">Poids cible (kg)</span>
          <input type="number" step={2.5} inputMode="decimal" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} className="w-full rounded-xl bg-zinc-900 px-4 py-4 font-black text-2xl text-white outline-none focus:ring-2 focus:ring-zinc-700 tabular-nums transition-all" />
        </label>
        <div className="text-right pb-3">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Par côté</span>
          <span className="font-black text-3xl tabular-nums text-white">{perSide > 0 ? perSide : 0}</span>
        </div>
      </div>

      {/* Barre visuelle IPF */}
      <div className="flex items-center justify-center gap-0.5 overflow-x-auto rounded-xl bg-zinc-900 py-8 mb-6">
        <div className="flex flex-row-reverse items-center gap-px">{plates.map((p, i) => <PlateDisc key={`l-${i}`} plate={p} />)}</div>
        <div className="h-4 w-8 rounded-sm bg-zinc-700" />
        <div className="h-3 w-12 bg-zinc-600" />
        <div className="flex flex-col items-center px-2"><span className="text-[10px] font-black text-zinc-400">20KG</span></div>
        <div className="h-3 w-12 bg-zinc-600" />
        <div className="h-4 w-8 rounded-sm bg-zinc-700" />
        <div className="flex items-center gap-px">{plates.map((p, i) => <PlateDisc key={`r-${i}`} plate={p} />)}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {plates.length === 0 ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{target <= BAR_WEIGHT ? 'BARRE À VIDE (20 KG)' : 'CHARGE INSUFFISANTE'}</span>
        ) : (
          summarize(plates).map((s) => <span key={s.label} className="rounded-md bg-zinc-800 px-3 py-1.5 font-black tabular-nums text-[10px] text-white">{s.count} × {s.label}</span>)
        )}
        {!achievable && remainder > 0 && <span className="rounded-md bg-white text-black px-3 py-1.5 font-black text-[10px] uppercase tracking-widest">RESTE {remainder} KG</span>}
      </div>
    </div>
  )
}

function PlateDisc({ plate }: { plate: { weight: number; color: string; label: string } }) {
  const heights: Record<number, string> = { 25: 'h-24', 20: 'h-20', 15: 'h-16', 10: 'h-12', 5: 'h-10', 2.5: 'h-8', 1.25: 'h-6' }
  const widths: Record<number, string> = { 25: 'w-4', 20: 'w-4', 15: 'w-3.5', 10: 'w-3', 5: 'w-3', 2.5: 'w-2.5', 1.25: 'w-2.5' }
  return (
    <div className={`flex ${heights[plate.weight]} ${widths[plate.weight]} items-center justify-center rounded-[2px] border border-black/40`} style={{ background: plate.color }} title={`${plate.label} kg`}>
      <span className="rotate-90 text-[8px] font-black text-black/80">{plate.label}</span>
    </div>
  )
}
function summarize(plates: { label: string }[]) { const map = new Map<string, number>(); for (const p of plates) map.set(p.label, (map.get(p.label) ?? 0) + 1); return Array.from(map.entries()).map(([label, count]) => ({ label, count })) }